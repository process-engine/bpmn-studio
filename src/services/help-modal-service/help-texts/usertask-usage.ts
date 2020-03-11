import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const UserTaskUsage: HelpText = {
  title: 'How to use user tasks',
  message: removeMultilineIndent(`
  When a process is executed, it progresses through the different elements of the diagram and captures states along the way.
  This progression and state accumulation can be visualized as a token moving along the execution's path in the diagram.

  The data of previous tasks can be accessed through the token.
  In order to do so make use of:

  - \`token.current\` - To access the task that immediately preceded the script task.
  - \`token.history.<id-of-previous-task>\` - To access a specific preceding task.

  To use user tasks you must add one or more form fields to the task.

  **The form fields have different types, such as:**

  - Text: Shows an input field for texts
  - Integer: Shows an input field for numbers
  - Decimal: Shows an input field for decimal number
  - Truth value: Shows a checkbox, especially if the user task is a \`confirm\` control
  - Date: Shows an input field for dates
  - Enumeration: Shows a dropdown list
  - Custom

  **Each form field also has the following properties:**

  - ID: The form field's ID. Can be used to access the form field through the token
  - Label: The displayed name of the form field
  - Default Value: The default value of the form field

  The values for \`label\` and \`default value\` can be anything.
  However, you can also use token expressions.

  **Example:**

  We have a task with the ID \`Default_Checked_Task\` that returns an object with a property called \`checked\` that is true or false.

  A form field of type \`Truth Value\` gets the default value property \`\${token.history.Default_Checked_Task.checked}\`.
  The check box will now be checked, when \`Default_Checked_Task.checked\` equals \`true\` . Otherwise, it will not be checked.


  **Attaching a confirmation dialog:**

  A confirmation dialog can be used to ask the user a question. These dialogues come with a \`decline\` and \`proceed\` option, by which the user can either proceed or decline the task.
  A simple example is a user task for displaying some terms of usage, where the user is asked \`Do you accept our terms and condition?\`

  To add a confirmation dialog, add a property named \`preferredControl\` to the user task and assign the value \`confirm\`.

  If the user task is a confirmation dialog, you can use the first \`Truth Value\` form field to configure your text and question.
  It must be set as the \`Default Value\` property.
  `),
};
