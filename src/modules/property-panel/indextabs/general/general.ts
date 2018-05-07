import {IIndextab, IPageModel, ISection, IShape} from '../../../../contracts';
import {BasicsSection} from './sections/basics/basics';
import {CallActivitySection} from './sections/call-activity/call-activity';
import {ConditionalEventSection} from './sections/conditional-event/conditional-event';
import {ErrorEventSection} from './sections/error-event/error-event';
import {EscalationEventSection} from './sections/escalation-event/escalation-event';
import {FlowSection} from './sections/flow/flow';
import {MessageEventSection} from './sections/message-event/message-event';
import {PoolSection} from './sections/pool/pool';
import {ScriptTaskSection} from './sections/script-task/script-task';
import {SignalEventSection} from './sections/signal-event/signal-event';
import {TimerEventSection} from './sections/timer-event/timer-event';

export class General implements IIndextab {
  public title: string = 'General';
  public path: string = '/indextabs/general/general';
  public elementInPanel: IShape;

  public basicsSection: ISection = new BasicsSection();
  public poolSection: ISection = new PoolSection();
  public messageEventSection: ISection = new MessageEventSection();
  public signalEventSection: ISection = new SignalEventSection();
  public scriptTaskSection: ISection = new ScriptTaskSection();
  public callActivitySection: ISection = new CallActivitySection();
  public flowSection: ISection = new FlowSection();
  public errorEventSection: ISection = new ErrorEventSection();
  public escalationEventSection: ISection = new EscalationEventSection();
  public conditionalEventSection: ISection = new ConditionalEventSection();
  public timerEventSection: ISection = new TimerEventSection();

  public sections: Array<ISection> = [
    this.basicsSection,
    this.poolSection,
    this.messageEventSection,
    this.signalEventSection,
    this.scriptTaskSection,
    this.callActivitySection,
    this.flowSection,
    this.errorEventSection,
    this.escalationEventSection,
    this.conditionalEventSection,
    this.timerEventSection,
  ];

  public canHandleElement: boolean = true;

  public isSuitableForElement(element: IShape): boolean {
    this.sections.forEach((section: ISection) => {
      section.canHandleElement = section.isSuitableForElement(element);
    });

    return this.sections.some((section: ISection) => {
      return section.canHandleElement;
    });
  }

  public activate(model: IPageModel): void {
    this.elementInPanel = model.elementInPanel;
  }

}
