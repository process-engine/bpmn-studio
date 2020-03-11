import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const ScriptTaskTokenUsage: HelpText = {
  title: 'How to use the token',
  message: removeMultilineIndent(`
  When a process is executed, it progresses through the different elements of the diagram and captures states along the way.
  This progression and state accumulation can be visualized as a token moving along the execution's path in the diagram.

  The data of previous tasks can be accessed through the token.

  In order to do so make use of:
  - \`token.current\` - To access the task that immediately preceded the script task.
  - \`token.history.<id-of-previous-task>\` - To access a specific preceding task.
    `),
};
