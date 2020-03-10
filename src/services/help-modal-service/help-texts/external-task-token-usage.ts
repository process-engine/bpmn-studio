import {HelpText} from '../../../contracts/index';

export const ExternalTaskTokenUsage: HelpText = {
  title: 'How to use the results from previous tasks?',
  message: `When a process is executed, it progresses through the different elements of the diagram and captures state along the way.
  This progression and state accumulation can be visualized as a token moving along the execution's path in the diagram.

  The data of previous tasks can be accessed through the token.
    Examples of using the token as a payload or topic for ExternalTasks:

    1. To use the given user data from previous tasks, e.g. an account registration worker.
       The full ExternalTask configuration could look like this:

       Topic: EXAMPLE_TOPIC
       Payload:
       {
        firstName: token.history.AskForName.firstName,
        lastName: token.history.AskForName.lastName,
        rememberMyDetails: token.history.AskForConsent.rememberMyDetails,
        sendMeLotsOfEmails: token.history.AskForConsent.sendMeLotsOfEmails
       }

    2. To split the token into an object, the configuration could look like this:

       Topic: EXAMPLE_TOPIC
       Payload:
        {
          currentToken: token.current,
          tokenHistory: token.history
        }

    3. Custom Topics:

       Topic: token.current + 'my string'
       Payload: EXAMPLE_PAYLOAD

      Note: String operations also work for payloads.
   `,
};
