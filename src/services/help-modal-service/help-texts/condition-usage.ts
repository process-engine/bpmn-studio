import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const ConditionUsage: HelpText = {
  title: 'How to use conditions',
  message: removeMultilineIndent(`
  When a process is executed, it progresses through the different elements of the diagram and captures states along the way.
  This progression and state accumulation can be visualized as a token moving along the execution's path in the diagram.

  The data of previous tasks can be accessed through the token.

  In order to do so make use of:
  - \`token.current\` - To access the task that immediately preceded the script task.
  - \`token.history.<id-of-previous-task>\` - To access a specific preceding task.

  **Example of using the token as a condition on sequence flows:**

  We have a task with the ID \`User_Age\` that returns an object with a property called \`age\` that is a number.

  We want to check whether the user is 18 or older to determine which sequence flow should be executed.
  If the user is 18 or over the first sequence flow should be used for the process execution.

  The condition of the first sequence flow must look like:

  \`token.history.User_Age.age >= 18\`

  The condition of the second sequence flow now could be:

  \`token.history.User_Age.age < 18\`

  The second condition is not necessary if you set the second sequence flow as **default flow**.

  A default flow means it is choosed for execution if no other sequence flows condition has matched.

  You can set it by selecting the sequence flow, then click on the wrench and default flow.
  <div style="text-align: center;">
    <img src="src/resources/images/default_flow.png" width="200px">
  </div>
  `),
};
