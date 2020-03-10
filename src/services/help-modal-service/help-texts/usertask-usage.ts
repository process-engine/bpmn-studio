import {HelpText} from '../../../contracts/index';

export const UserTaskUsage: HelpText = {
  title: 'How to use UserTasks',
  message: `To use UserTasks you must add one or more form fields to the task.

    The form fields have different types such as:

    - Text: shows an input field for texts
    - Integer: shows an input field for numbers
    - Decimal: shows an input field for decimal number
    - Truth value: shows a checkbox, especially if the UserTask is a "confirm" control
    - Date: shows an input field for dates
    - Enumeration: shows a dropdown list
    - Custom

    Each form field also has the following properties:

    - ID: the ID of the form field
    - Label: the displayed name of the form field
    - Default Value: the default value of the form field

    The values for "label" and "default value" can be any thing.
    However, you can also use token expressions.

    Example:

    We have a task with the ID "Default_Checked_Task" that returns an object with a property called "checked" that is true or false.

    A form field of type "Truth Value" gets the default value property "\${token.history.Default_Checked_Task.checked}".
    The check box is now be checked, when "Default_Checked_Task.checked" equals "true" . Otherwise, it will not be checked.


    Attaching a confirmation dialog:

    A confirm control / user task can ask the user something or simply display a text and offers the possibility that the user can reject or continue the task.
    A simple example is a UserTask for displaying some terms of usage, where the user is asked "Do you accept our terms and condition?"

    To add a confirmation dialog, add a property named "preferredControl" to the UserTask and assign the value "confirm".

    If the UserTask is a confirmation dialog, you can use the first "Truth Value" form field to configure your text and question.
    It must be set as the "Default Value" property.
    `,
};
