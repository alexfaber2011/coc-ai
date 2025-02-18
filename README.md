# coc-ai

This project is a fork of [vim-ai](https://github.com/madox2/vim-ai) by [madox2](https://github.com/madox2).
I would like to express my gratitude to the original author for their work.

## Changes in This Fork

- Replaced Python code with TypeScript.
- Integrated with [coc.nvim](https://github.com/neoclide/coc.nvim) for async AI features.

## Install

1. Ensure your vim is newer than 9 and node is newer than 18: `node --version`,
hint for miserable CentOS users: [Node.js unofficial-builds project](https://github.com/nodejs/unofficial-builds?tab=readme-ov-file#local-installation)
2. Install `coc.nvim`. Checkout
 [Install coc.nvim](https://github.com/neoclide/coc.nvim/wiki/Install-coc.nvim)
 for more infomation.
3. Use command `:CocInstall https://github.com/Kuro96/coc-ai` in your vim

## Configurations

### Role Options

See `roles-example.toml`.
Make a copy of your own and specify path to it with `coc-ai.global.rolesConfigPath`.

Available Options, only `prompt` is **REQUIRED**:

```toml
[<your role name>]
prompt = "<extra prompt which will be add to user prompt>"

[<your role name>.options]
model = "<model name>"
proxy = "<protocol>://<ip>:<port>"  # NOT available for now
maxTokens = 4096  # <max token num>
temperature = 0.6  # <temperature>
requestTimeout = 20  # <timout in seconds>
initialPrompt = "<overrides `initialPrompt` in coc-settings>"

[<your role name>.options-chat]
# same as options, overrides for `AIChat` command

[<your role name>.options-complete]
# same as options, overrides for `AI` command

[<your role name>.options-edit]
# same as options, overrides for `AIEdit` command
```

### Chat Options

**ONLY** available with `AIChat` command.

Available options, checkout
 [package.json](https://github.com/Kuro96/coc-ai/blob/main/package.json) for detail:

```toml
model = "<model name>"
endpointUrl = "<protocol>://<hostname>/v1/chat/completions"
proxy = "<protocol>://<ip>:<port>"  # NOT available for now
maxTokens = 4096  # <max token num>
temperature = 0.6  # <temperature>
requestTimeout = 20  # <timout in seconds>

requiresAuth = true  # <boolean>
initialPrompt = "<overrides `initialPrompt` in coc-settings>"
tokenPath = "<path to your token file>"
rolesConfigPath = "<path to your roles config path>"
autoScroll = true  # <boolean>
codeSyntaxEnabled = true  # <boolean>
preserveFocus =  true  # <boolean>
populatesOptions = false  # <boolean>
openChatCommand = "<preset_below|preset_tab|preset_right|<your own command>>"
scratchBufferKeepOpen = false  # <boolean>
```

### Coc options

`coc-settings.json`, see [docs](https://github.com/neoclide/coc.nvim/wiki/Using-the-configuration-file)
of `coc.nvim` for more info. You can edit it by command `:CocConfig`.

Also you can refer to my example below:

```json
{
  "coc-ai.global.model": "deepseek-chat",
  "coc-ai.global.endpointUrl": "https://api.deepseek.com/v1/chat/completions",
  "coc-ai.global.requiresAuth": true,
  "coc-ai.global.tokenPath": "~/.vim/token",
  "coc-ai.global.rolesConfigPath": "~/.vim/vimrc.d/coc-ai-roles.toml",
  "coc-ai.chat.autoScroll": true,
  "coc-ai.chat.scratchBufferKeepOpen": false,
  "coc-ai.chat.populatesOptions": true,
  "coc-ai.chat.preserveFocus": true,
  "coc-ai.chat.openChatCommand": "preset_right",
}
```

### Priority

role options > chat options > Coc options

## Usage

1. AIChat: `:[%]['<,'>]AIC[hat] [/<role>] [<prompt>]`
2. AIEdit: `:[%]['<,'>]AIE[dit] [/<role>] [<prompt>]`
3. AIComplete: `:[%]['<,'>]AI [/<role>] [<prompt>]`
4. AIStop: `:AIS[top]`
5. AIBack(resume hidden chat window if `scratchBufferKeepOpen` set to `true`): `:AIB[ack]`

NOTE:

- any characters inside `[]` is optional
- `:%` equal to `:1,$`, checkout `:help :%`, as well as `:help '<` `:help '>`
- `/role` **MUST** precede `prompt`
- `/role` can be specified multiple times, and the latter configuration will
 override the former.

### Examples

```viml
:AIC /r1 who are you?
:%AIC /gpt-4o-mini /explain 用中文回答
```

## TODOs

- [ ] proxy for post request
- [x] option for chat whether keep track with cursor
- [x] implement ai complete
- [x] implement ai edit
- [x] support `CocInstall`
- [x] README
- [ ] auto attach with `.aichat` files
- [ ] maybe auto-complete?
- [ ] AI abstraction for chats?

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
