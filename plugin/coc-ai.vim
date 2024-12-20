command! -range -nargs=? -complete=customlist,vim_ai#RoleCompletion CAI        <line1>,<line2>call coc_ai#AIRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,vim_ai#RoleCompletion CAIEdit    <line1>,<line2>call coc_ai#AIEditRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion CAIChat    <line1>,<line2>call coc_ai#AIChatRun(<range>, <q-args>)
command! -range -nargs=? -complete=customlist,coc_ai#RoleCompletion CAITest    <line1>,<line2>call coc_ai#AITestRun(<range>, <q-args>)

command! CAIStop call CocActionAsync('runCommand', 'coc-ai.stop')
