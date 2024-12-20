import { events, window, workspace, Disposable } from 'coc.nvim';

import { Engine } from './engine';
import { parseTaskRole } from './roles';
import { breakUndoSequence, KnownError, moveToBottom, resolveIncludeMessage } from './utils';

const { nvim } = workspace;

const chatPreset: IChatPreset = {
  "preset_below": "below new",
  "preset_tab": "tabnew",
  "preset_right": "rightbelow 55vnew | setlocal noequalalways | setlocal winfixwidth",
}

export class AIChats implements Disposable {
  capacity: number;
  #chats: Map<number, AIChat>;
  #bufnrs: Array<number>;
  #nextIndex: number;
  #disposable: Disposable;

  constructor(capacity: number = 10) {
    this.capacity = capacity;
    this.#nextIndex = 1;
    this.#bufnrs = new Array();
    this.#chats = new Map();

    this.#disposable = events.on('BufUnload', bufnr => {
      this.#removeChat(bufnr);
    })
  }

  /**
   * Updates the chat in the internal buffer and chat collections.
   * If the chat already exists in the buffer list, it moves it to the end.
   * Otherwise, it adds the chat to the chat map and buffer list.
   *
   * @param {AIChat} chat - The chat object to update.
   */
  #updateChat(chat: AIChat) {
    const i = this.#bufnrs.indexOf(chat.bufnr);
    if (i !== -1) {
      this.#bufnrs.splice(i, 1);
    }
    this.#chats.set(chat.bufnr, chat);
    this.#bufnrs.push(chat.bufnr);
  }

  #removeChat(bufnr: number) {
    const i = this.#bufnrs.indexOf(bufnr);
    if (i !== -1) {
      this.#chats.delete(bufnr);
      this.#bufnrs.splice(i, 1);
    }
  }

  includes(bufnr: number) { return this.#bufnrs.includes(bufnr) }

  async getChat(bufnr?: number): Promise<AIChat> {
    let chat: AIChat;
    if (bufnr !== undefined) {
      if (this.#chats.has(bufnr)) {
        chat = this.#chats.get(bufnr)!;
        this.#updateChat(chat);
      } else {
        console.warn(`bufnr: ${bufnr} not registered in AIChats, creating one...`);
        chat = await this.#newChat();
      }
    } else {
      if (this.#bufnrs.length) {
        bufnr = this.#bufnrs[this.#bufnrs.length - 1];
        chat = this.#chats.get(bufnr)!;
      } else {
        chat = await this.#newChat();
      }
    }
    if (chat.bufnr === -1) {
      window.showErrorMessage(
        'Failed to associate AIChat with existing window, ' +
        'is there any AIChat created outside coc-ai?');
    }

    return this.#chats.get(chat.bufnr)!
  }

  async #newChat(chatName?: string) {
    const name = chatName ?? this.#nextIndex === 1
      ? '>>> AI chat'
      : `>>> AI chat ${this.#nextIndex}`;
    const chat = await AIChat.create(name);
    console.debug(`New chat named "${name}": ${JSON.stringify(chat).substring(0, 100)}...`);
    this.#nextIndex += 1;
    this.#updateChat(chat);
    return chat;
  }

  dispose(): void {
    this.#disposable.dispose()
    for (let chat of this.#chats.values()) {
      chat.dispose()
    }
    this.#chats.clear();
    this.#bufnrs.length = 0;
  }
}

abstract class Task {
  abstract engine: Engine;
  /** 1. parse selection, rawPrompt
   *  2. parse role
   *  3. (chat only) parse messages, chat-options
   *  4. construct IMessage
   *  5. construct api options
   *  6. post request
   *  7. print result
   */
  abstract run(selection: string, rawPrompt: string): Promise<void>;
}

export class AIChat implements Task, Disposable {
  created = false;
  lines: string[] = [''];
  config: IEngineConfig;
  #bufnr: number = -1;
  #engine: Engine;
  #keepOpen: boolean;
  #openChatCMD: string;
  #codeSyntaxEnabled: boolean;  // TODO

  constructor(public name = '>>> AI chat') {
    this.#engine = new Engine('chat');
    this.config = this.#engine.config;
    this.#keepOpen = this.config.scratchBufferKeepOpen as boolean;
    this.#openChatCMD = this.config.openChatCommand!;
    this.#codeSyntaxEnabled = this.config.codeSyntaxEnabled!;

  }

  static async create(name: string = '>>> AI chat') {
    const chat = new AIChat(name);
    await chat.show();
    return chat;
  }

  async parseContent() {
    const indexHeaderEnd = await this.#getRoleLineIndex();
    const chatOptions = await this.#parseChatHeaderOptions(indexHeaderEnd);
    const indexMsgStart = indexHeaderEnd ? indexHeaderEnd + 1 : 1;
    const messages = await this.#parseChatMessages(indexMsgStart);

    return { messages, chatOptions }
  }

  async run(selection: string, rawPrompt: string) {
    // 1+2
    const sep = selection === '' || rawPrompt === '' ? '' : ':\n';
    let { prompt, options } = parseTaskRole(rawPrompt);
    prompt = prompt + sep + selection;  // role.prompt + user prompt + selection

    // 3
    const { messages, chatOptions } = await this.parseContent();
    let lastMessage = messages.pop();
    console.debug(JSON.stringify(lastMessage));
    if (lastMessage &&
        (lastMessage.role !== 'user' || lastMessage.content.trim() === '')) {
      messages.push(lastMessage);
    } else {
      console.debug('check failed');
      await this.appendLine('\n>>> user\n');
    }
    let mergedConfig: IEngineConfig
    if (chatOptions) mergedConfig = this.engine.mergeOptions(chatOptions);
    mergedConfig = this.engine.mergeOptions(options); // in case no options offerd

    // 4
    if (prompt) messages.push({ role: "user", content: prompt });
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      window.showInformationMessage('No new incoming user message found, skipped.')
      this.breakUndoSequence();
      return
    };
    await this.appendLine(prompt);

    // 5
    const data: IAPIOptions = {
      model: mergedConfig.model,
      messages: messages,
      max_tokens: mergedConfig.maxTokens,
      temperature: mergedConfig.temperature,
      stream: true,
    }

    // 6
    let resp = this.engine.generate(mergedConfig, data)
    await this.appendLine('\n<<< assistant\n');
    for await (const chunk of resp) this.append(chunk);
    await this.appendLine('');
    await this.appendLine('\n>>> user\n');
    await this.breakUndoSequence();
  }

  get engine(): Engine { return this.#engine }

  get bufnr() { return this.#bufnr }

  set bufnr(value: number) { this.#bufnr = value }

  append(value: string) {
    let idx = this.lines.length - 1;
    let newlines = value.split(/\r?\n/);
    let lastline = this.lines[idx] + newlines[0];
    this.lines[idx] = lastline;
    let append = newlines.slice(1);
    this.lines = this.lines.concat(append);
    if (!this.created) return;
    nvim.pauseNotification();
    nvim.call('setbufline', [this.name, '$', lastline], true);
    if (append.length) {
      nvim.call('appendbufline', [this.name, '$', append], true);
      moveToBottom(this.bufnr);
    }
    nvim.resumeNotification(true, true);
  }

  async appendLine(value: string) {
    if (!await nvim.call('getline', '$')) this.append('\n');
    this.append(value + '\n');
    moveToBottom(this.bufnr);
  }

  async appendLines(value: string) {
    const lines = value.split(/\r?\n/);
    for (const line of lines) {
      await this.appendLine(line);
    }
  }

  async #getRoleLineIndex() {
    let lines: string[] = await nvim.call('getbufline', [this.name, 1, '$']);
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('>>>')) {
        idx = i;
        break;
      }
    }
    return idx === -1 ? null : idx
  }

  async #parseChatHeaderOptions(end: number | null) {
    try {
      const options: IOptions = {};
      let lines: string[] = await nvim.call('getbufline', [this.name, 1, end ?? '$']);
      lines = lines.filter(p => p.trim() !== '');
      if (lines[0] !== '[chat-options]') return;

      for (const line of lines.slice(1)) {
        if (line.startsWith('#')) continue;
        let [key, value] = line.trim().split('=').map(x => x.trim());
        if (key in ['maxTokens', 'temperature', 'requestTimeout']) {
          options[key] = Number(value);
        } else if (key === 'pasteMode') {
          options[key] = value.toLowerCase() === 'true' || false;
        } else {
          options[key] = value;
        }
      }
      return options;
    } catch (error) {
      window.showInformationMessage('Invalid [chat-options]', 'error');
    }
  }

  async #parseChatMessages(start: number | null) {
    const lines: string[] = await nvim.call('getbufline', [this.name , start ?? 1, '$']);
    let messages: IMessage[] = [];
    for (const line of lines) {
      if (line.startsWith('>>> system')) {
        messages.push({ role: 'system', content: '' });
        continue;
      }
      if (line.startsWith('>>> user')) {
        messages.push({ role: 'user', content: '' });
        continue;
      }
      if (line.startsWith('>>> include')) {
        messages.push({ role: 'include', content: '' });
        continue;
      }
      if (line.startsWith('<<< assistant')) {
        messages.push({ role: 'assistant', content: '' });
        continue;
      }
      if (!messages.length) {
        continue;
      }
      messages[messages.length - 1].content += '\n' + line;
    }

    for (const message of messages) {
      message.content = message.content.trim();
      if (message.role === 'include') resolveIncludeMessage(message);
    }
    return messages;
  }

  clearContents(keep?: number): void {
    this.lines = keep ? this.lines.slice(-keep) : [''];
    if (!this.created) return;
    nvim.pauseNotification();
    nvim.call('deletebufline', [this.name, 1, '$'], true);
    if (this.lines.length) {
      nvim.call('appendbufline', [this.name, '$', this.lines], true);
    }
    nvim.resumeNotification(true, true);
  }

  /*  If not keep open, clear AIChat contents. */
  hide() {
    if (!this.#keepOpen) {
      this.abort();
      this.clearContents();
      this.created = false;
    }
  }

  async #tryResumeWindow() {
    const winid: number = await nvim.call('bufwinid', [this.name]);
    if (winid !== -1) {
      await nvim.call('win_gotoid', winid);
      if (this.#bufnr === -1) {
        return 'detached';
      } else {
        return 'attached';
      }
    }
    return false
  }

  /**
   * Create or resume the chat window, keeping synced with buffer.
   * @param preserveFocus - If true, the focus will be preserved on the current window after showing the chat window.
   * @param cmd - The command to use for displaying the chat window. Defaults to 'preset_below'.
   */
  async show(preserveFocus?: boolean) {
    const isChat = (await nvim.call('bufname', '%') === this.name) ? true : false;
    preserveFocus = preserveFocus ?? this.config.preserveFocus!;
    const status = await this.#tryResumeWindow();
    if (!status) {
      const command = this.#openChatCMD in chatPreset
        ? chatPreset[this.#openChatCMD]
        : this.#openChatCMD;
      nvim.command(`${command} ${this.name}`);

      this.bufnr = await nvim.call('bufnr', '%');

      nvim.command('setlocal buftype=nofile noswapfile ft=aichat');
      if (this.#keepOpen) {
        nvim.command('setlocal bufhidden=hide');
      } else {
        nvim.command('setlocal bufhidden=wipe');
      }
      this.created = true;
    } else if (status === 'detached') {
      this.bufnr = await nvim.call('bufnr', '%');
      this.created = true;
    }

    const contents: string[] = await nvim.call('getbufline', [this.bufnr, 1, '$']);
    this.lines = contents.length ? contents : [''];

    if (preserveFocus && !isChat) await nvim.command('wincmd p');
  }

  async abort() {
    if (!this.#engine.controller.signal.aborted) this.#engine.controller.abort();
  }

  /**
   * Breaks the undo sequence in the current buffer.
   * NOTE: If the current buffer is not the target buffer, it temporarily switches to the target buffer,
   * breaks the undo sequence, and then returns to the original window.
   */
  async breakUndoSequence() {
    const currBufnr = await nvim.call('bufnr', '%');
    const currWinid = await nvim.call('bufwinid', '%');
    if (currBufnr != this.bufnr) await this.#tryResumeWindow();
    await breakUndoSequence();
    if (currBufnr != this.bufnr) await nvim.call('win_gotoid', currWinid);
  }

  dispose() {
    // TODO
  }
}
