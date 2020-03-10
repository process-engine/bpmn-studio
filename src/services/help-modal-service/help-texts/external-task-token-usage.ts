import {HelpText} from '../../../contracts/index';

export const ExternalTaskTokenUsage: HelpText = {
  title: 'How to use the results from previous tasks?',
  message: `The data of previous tasks can be accessed via the token.
    Examples of using the token as a payload or topic for ExternalTasks:

    1. To get the full token in your ExternalTask worker simply type \`token\` into the payload field.
       The full ExternalTask configuration could look like this:

       Topic: EXAMPLE_TOPIC
       Payload: token

    2. To split the token into an object, the configuration could look like this:

       Topic: EXAMPLE_TOPIC
       Payload:
        {
          currentToken: token.current,
          tokenHistory: token.history
        }

    3. If the token current token is a string, you can combine it with other strings:

       Topic: EXAMPLE_TOPIC
       Payload: token.current + 'my string'

      Note: You can use the JSON.stringify method to stringify the token if it is an object.

    To use the token for the "Topic" field just look at point 3.
   `,
};
