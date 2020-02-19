import {HelpMessage} from '../../../contracts/index';

export const ScriptTaskTokenUsageHelpMessage: HelpMessage = {
  title: 'How to use the token',
  message:
    'The data of previous tasks can be accessed via the token.\nIn order to do so make use of:\n"token.current" - In order to use the data of the previous tasks\n"token.history.<id-of-previous-task>" - In order to use the data of a specific tasks.',
};
