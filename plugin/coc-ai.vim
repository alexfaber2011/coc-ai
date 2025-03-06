autocmd BufRead,BufNewFile *.aichat set filetype=aichat
autocmd BufRead,BufNewFile *.aichat call CocActionAsync('runCommand', 'coc-ai.attachChat')

command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion AI        <line1>,<line2>call coc_ai#AIRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion AIEdit    <line1>,<line2>call coc_ai#AIEditRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion AIChat    <line1>,<line2>call coc_ai#AIChatRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion AINewChat <line1>,<line2>call coc_ai#AINewChatRun(<range>, <q-args>)

command! AIStop call CocActionAsync('runCommand', 'coc-ai.stop')
command! AIBack call CocActionAsync('runCommand', 'coc-ai.show')
