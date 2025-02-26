set foldmethod=syntax

syntax match aichatRole ">>> system"
syntax match aichatRole ">>> user"
syntax match aichatRole ">>> include"
syntax match aichatRole "<<< assistant"

syntax region aichatReasonBlock
    \ start="^<think>$"
    \ end="^</think>$"
    \ contains=@NoSpell
    \ fold

highlight default link aichatRole      Comment
highlight default link aichatReasonBlock Comment
