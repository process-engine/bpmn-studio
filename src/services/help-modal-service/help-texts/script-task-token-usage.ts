import {HelpText} from '../../../contracts/index';

export const ScriptTaskTokenUsageHelpText: HelpText = {
  title: 'How to use the token',
  message:
    `The data of previous tasks can be accessed via the token.
    
    In order to do so make use of:
    
    "token.current" - In order to use the data of the previous tasks
    "token.history.<id-of-previous-task>" - In order to use the data of a specific tasks.`,
};
