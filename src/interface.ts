interface IRoleConfig {
  prompt: string,
  options?: IOptions,              // global/merged
  'options-chat'?: IOptions,       // chat
  'options-complete'?: IOptions,   // complete
  'options-edit'?: IOptions,       // edit
}

interface IMessage {
  role: 'system' | 'user' | 'assistant' | 'include',
  content: string,
}

interface IToken {
  apiKey: string,
  orgId: string | null,
}

interface IAPIOptions {
  model: string,
  messages: IMessage[],
  max_tokens?: number,
  temperature?: number,
  stream?: boolean,
}

interface IEngineConfig {
  model: string,
  endpointUrl: string,
  proxy: string,
  maxTokens: number,
  temperature: number,
  requestTimeout: number,
  requiresAuth: boolean,
  initialPrompt: string,
  tokenPath: string,
  rolesConfigPath: string,

  // chat
  autoScroll?: boolean,
  codeSyntaxEnabled?: boolean,
  preserveFocus?: boolean,
  populatesOptions?: boolean,
  openChatCommand?: string,
  scratchBufferKeepOpen?: boolean,
}

interface IOptions {
  model?: string,
  proxy?: string,
  maxTokens?: number,
  temperature?: number,
  requestTimeout?: number,
  initialPrompt?: string,
}

interface IChatPreset {
  preset_below: string,
  preset_tab: string,
  preset_right: string,
}

interface IChunk {
  type: 'content' | 'reasoning_content',
  content: string,
}
