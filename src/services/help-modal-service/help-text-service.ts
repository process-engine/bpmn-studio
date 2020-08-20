import {DataObjectsUsage} from './help-texts/data-objects-usage';
import {IntermediateTimerEventUsage} from './help-texts/intermediate-timer-event-usage';
import {TimerBoundaryEventUsage} from './help-texts/timer-boundary-event-usage';
import {UserTaskUsage} from './help-texts/usertask-usage';
import {ExternalTaskTokenUsage} from './help-texts/external-task-token-usage';
import {ScriptTaskTokenUsage} from './help-texts/script-task-token-usage';
import {ConditionUsage} from './help-texts/condition-usage';
import {TimerStartEventUsage} from './help-texts/timer-start-event-usage';

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
      case HelpTextId.IntermediateTimerEventUsage:
        return IntermediateTimerEventUsage;
      case HelpTextId.DataObjectsUsage:
        return DataObjectsUsage;
      default:
        throw new Error(`Help message with id "${helpTextId}" is unknown.`);
    }
  }
}
