# coc-ai

This project is a fork of [vim-ai](https://github.com/madox2/vim-ai) by [madox2](https://github.com/madox2).
I would like to express my gratitude to the original author for their work.

## Changes in This Fork

- Replaced Python code with TypeScript.
- Integrated with [coc.nvim](https://github.com/neoclide/coc.nvim) for async AI features.

## Install

    1. Ensure your node version is newer than 18: `node --version`
    2. Use command `:CocInstall https://github.com/Kuro96/coc-ai` in your vim

## TODOs

- [ ] proxy for post request
- [x] option for chat whether keep track with cursor
- [x] implement ai complete
- [x] implement ai edit
- [x] support `CocInstall`
- [ ] README
- [ ] auto attach with `.aichat` files
- [ ] maybe auto-complete?
- [ ] AI abstraction for chats?

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
