import { commands, ExtensionContext, window, workspace } from 'coc.nvim';

import { AIChats } from './aichat';
import { getRoles } from './roles';

const config = workspace.getConfiguration('coc-ai');
const { nvim } = workspace;

export async function activate(context: ExtensionContext) {
  window.showInformationMessage('coc-ai loaded!');
  const enabled = config.get<boolean>('enabled', true);
  if (!enabled) { return };

  const aichats = new AIChats();
  context.subscriptions.push(
    commands.registerCommand('coc-ai.chat', async (selection: string, rawPrompt: string) => {
      const bufList = await nvim.call('tabpagebuflist') as number[];
      const bufnr = bufList.filter(x => aichats.includes(x)).pop();
      const aichat = await aichats.getChat(bufnr);
      await aichat.run(selection, rawPrompt);
    }),
    commands.registerCommand('coc-ai.stop', async () => {
      aichats.getChat()
        .then(chat => chat.abort())
        .catch(e => console.error(e));
    }),
    commands.registerCommand('coc-ai.roleComplete', () => {
      return Object.keys(getRoles() ?? {});
    }),
    workspace.registerAutocmd({
      event: 'BufWinLeave',
      pattern: '*AI*chat*',
      request: true,
      callback: async () => {
        const bufnr = await nvim.call('bufnr', '%');
        (await aichats.getChat(bufnr)).hide();
        window.showInformationMessage(`Leave aichat with bufnr: ${bufnr}`);
      },
    }),
  );
}
