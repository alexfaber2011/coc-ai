set foldmethod=syntax

syntax match aichatRole ">>> system"
syntax match aichatRole ">>> user"
syntax match aichatRole ">>> include"
syntax match aichatRole "<<< assistant"

syntax region aichatReasonBlockOllama
    \ start="^<think>$"
    \ end="^</think>$"
    \ contains=@NoSpell
    \ fold
syntax region aichatReasonBlock
    \ start="^---reason start---$"
    \ end="^---reason finish---$"
    \ contains=@NoSpell
    \ fold

highlight default link aichatRole      Comment
highlight default link aichatReasonBlock Comment
highlight default link aichatReasonBlockOllama Comment
