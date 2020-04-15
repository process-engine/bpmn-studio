import {HelpText} from '../../../contracts/index';
import {removeMultilineIndent} from '../remove-multiline-indent';

export const ExternalTaskTokenUsage: HelpText = {
  title: 'How to use the results from previous tasks',
  message: removeMultilineIndent(`
  When a process is executed, it progresses through the different elements of the diagram and captures states along the way.
  This progression and state accumulation can be visualized as a token moving along the execution's path in the diagram.

  The data of previous tasks can be accessed through the token.

  In order to do so make use of:

  - \`token.current\` - To access the task that immediately preceded the script task.
  - \`token.history.<id-of-previous-task>\` - To access a specific preceding task.

  **Examples of using the token as a payload or topic for external tasks:**

  1. To use the given user data from previous tasks, e.g. an account registration worker:

      Topic: \`EXAMPLE_TOPIC\`

      Payload:
      \`\`\`javascript
      {
      firstName: token.history.AskForName.firstName,
      lastName: token.history.AskForName.lastName,
      rememberMyDetails: token.history.AskForConsent.rememberMyDetails,
      sendMeLotsOfEmails: token.history.AskForConsent.sendMeLotsOfEmails
      }
      \`\`\`

  2. To use the current token, the configuration could look like this:

      Topic: \`EXAMPLE_TOPIC\`

      Payload:
      \`\`\`javascript
      {
        currentToken: token.current
      }
      \`\`\`

  3. Custom Topics:

    Sometimes it is useful to control which workers are able to execute certain tasks, e.g. dealing with sensitive information.

    We can implement this use case by assigning a secret to our token und using a "dynamic topic" for the external task.

    To use the secret, your topic might look like this:

    Topic: \`'handle-sensitive-data.' + token.current.mySecret\`

    If we add the secret to the topic, then only those external task workers which know the secret can subscribe and process the task.

    Please also that you can name these things differently: both the term "secret" as well as the field name \`mySecret\` are arbitrary choices.

    Payload: \`YOUR_PAYLOAD\`

    Please also note: String operations also work for payloads.
   `),
};
