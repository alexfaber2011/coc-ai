import path from 'path';
import { commands, ExtensionContext, workspace } from 'coc.nvim';

import { AIChats, hideChat } from './aichat';
import { getRoles } from './roles';

const config = workspace.getConfiguration('coc-ai');
const { nvim } = workspace;

export async function activate(context: ExtensionContext) {
  const enabled = config.get<boolean>('enabled', true);
  if (!enabled) { return };
  const directory = path.resolve(__dirname, '..').replace(/'/g, "''");
  nvim.command(`execute 'noa set rtp+='.fnameescape('${directory}')`, true)
  nvim.command(`source ${directory}/plugin/*.vim`, true)
  console.debug('coc-ai loaded!');

  const aichats = new AIChats();
  context.subscriptions.push(
    commands.registerCommand('coc-ai.chat', async (selection: string, rawPrompt: string) => {
      const bufList = await nvim.call('tabpagebuflist') as number[];
      const bufnr = bufList.filter(x => aichats.includes(x)).pop();
      const aichat = await aichats.getChat(bufnr, bufnr ? false : true);
      await aichat.run(selection, rawPrompt);
    }),
    commands.registerCommand('coc-ai.show', async () => {
      await aichats.getChat(undefined, true);
    }),
    commands.registerCommand('coc-ai.stop', async () => {
      aichats.getChat() // Assume we always interrupt the most recent one
        .then(chat => chat.abort())
        .catch(e => console.error(e));
    }),
    commands.registerCommand('coc-ai.roleComplete', () => {
      return Object.keys(getRoles() ?? {});
    }),
    workspace.registerAutocmd({
      event: 'BufWinLeave',
      pattern: '>>>?AI?chat*',
      callback: async () => { await hideChat(aichats) },
    }),
  );
}
