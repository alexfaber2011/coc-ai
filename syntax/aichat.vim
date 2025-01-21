syntax match aichatRole ">>> system"
syntax match aichatRole ">>> user"
syntax match aichatRole ">>> include"
syntax match aichatRole "<<< assistant"

syntax region aichatReasonBlock
    \ start="^---reason start---$"
    \ end="^---reason finish---$"
    \ contains=@NoSpell

highlight default link aichatRole      Comment
highlight default link aichatReasonBlock Comment
