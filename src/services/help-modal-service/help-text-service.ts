import {ScriptTaskTokenUsageHelpMessage} from './help-texts/script-task-token-usage';

import {HelpMessage, HelpMessageId} from '../../contracts/index';

export class HelpTextService {
  public getHelpMessageById(helpMessageId: HelpMessageId): HelpMessage {
    switch (helpMessageId) {
      case HelpMessageId.ScriptTaskTokenUsageHelpMessage:
        return ScriptTaskTokenUsageHelpMessage;
      default:
        throw new Error(`Help message with id "${helpMessageId}" is unknown.`);
    }
  }
}
