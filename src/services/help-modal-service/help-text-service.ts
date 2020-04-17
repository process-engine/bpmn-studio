import {UserTaskUsage} from './help-texts/usertask-usage';
import {ExternalTaskTokenUsage} from './help-texts/external-task-token-usage';
import {ScriptTaskTokenUsage} from './help-texts/script-task-token-usage';
import {ConditionUsage} from './help-texts/condition-usage';

import {HelpText, HelpTextId} from '../../contracts/index';

export class HelpTextService {
  public getHelpTextById(helpTextId: HelpTextId): HelpText {
    switch (helpTextId) {
      case HelpTextId.ScriptTaskTokenUsage:
        return ScriptTaskTokenUsage;
      case HelpTextId.ExternalTaskTokenUsage:
        return ExternalTaskTokenUsage;
      case HelpTextId.UserTaskUsage:
        return UserTaskUsage;
      case HelpTextId.ConditionUsage:
        return ConditionUsage;
      case HelpTextId.TimerBoundaryEventUsage:
        return TimerBoundaryEventUsage;
      case HelpTextId.TimerStartEventUsage:
        return TimerStartEventUsage;
      default:
        throw new Error(`Help message with id "${helpTextId}" is unknown.`);
    }
  }
}
