import {ScriptTaskTokenUsageHelpMessage} from './help-texts/script-task-token-usage';

import {HelpMessage} from '../../contracts/index';

const messageMap = {
  'script-task-token-usage': ScriptTaskTokenUsageHelpMessage,
};

export class HelpTextService {
  public getHelpMessageById(helpMessageId: string): HelpMessage {
    return messageMap[helpMessageId];
  }
}
