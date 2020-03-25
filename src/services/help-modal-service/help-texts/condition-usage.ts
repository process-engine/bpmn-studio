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

  We want to check if the user is aged 18 or above. The result of this check will determine through which path our process will continue.
  If the user *is* 18 or above, the process should continue through the first sequence flow.
  Otherwise, the path following through the second sequence flow should be taken.

  To accomplish this, we can add a condition to each of the sequence flow.
  
  The first sequence flow gets the following condition:

  \`token.history.User_Age.age >= 18\`

  For the second sequnce flow, we have two options. 
  
  We could add the following condition:

  \`token.history.User_Age.age < 18\`

  Or we could set the second sequence flow as **default flow**.

  A default flow will always be executed, when no other sequence flow's condition was fulfilled.
  
  In our example, this would be the case, if the user is **not** 18 or above.

  To mark a sequnce flow as 'default', select it, then click on the wrench and choose 'default flow'.
  <div style="text-align: center;">
    <img src="src/resources/images/default_flow.png" width="200px">
  </div>
  `),
};
