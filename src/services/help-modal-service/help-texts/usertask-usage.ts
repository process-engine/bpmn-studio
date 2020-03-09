import {HelpText} from '../../../contracts/index';

export const UserTaskUsage: HelpText = {
  title: 'How to use UserTasks',
  message: `To use UserTasks you must add one or more form fields to the task.

    The form fields have different types such as:

    - Text (shows an input field for texts)
    - Integer (shows an input field for numbers)
    - Decimal (shows an input field for decimal number)
    - Truth value (shows a checkbox, especially if the UserTask is a "confirm" control)
    - Date (shows an input field for dates)
    - Enumeration (shows a dropdown list)
    - Custom

    Each form field also has the following properties:

    - ID (the ID of the form field used for the token)
    - Label
    - Default Value

    The "label" and the "default value" can be set via the process token.

    Example:

    We have a task with the ID "Default_Checked_Task" that returns an object with a property called "checked" that is true or false.

    A form field of type "Truth Value" gets the default value property "\${token.history.Default_Checked_Task.checked}".
    The check box is now selected when "Default_Checked_Task" returns true and not selected when false is returned.


    Confirm Control/UserTask:

    A confirm control / user task can ask the user something or simply display a text and offers the possibility that the user can reject or continue the task.
    A simple example is a UserTask, in which the user makes some entries and ends up with a question such as "Do you accept our terms and conditions?"

    To use the confirm control simply add a property named "preferredControl" with the value "confirm" to the UserTask.

    If the UserTask is a confirm, the first "Truth Value" form field of the UerTask is the place where you can define your question/text.
    It must be set as the "Default Value" property.
    `,
};
