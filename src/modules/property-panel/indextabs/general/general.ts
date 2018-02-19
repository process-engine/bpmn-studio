import {IEvent,
        IEventBus,
        IIndextab,
        IModdleElement,
        IPageModel,
        ISection,
        IShape} from '../../../../contracts';
import {BasicsSection} from './sections/basics/basics';
import {CallActivitySection} from './sections/call-activity/call-activity';
import {ErrorEventSection} from './sections/error-event/error-event';
import {EscalationEventSection} from './sections/escalation-event/escalation-event';
import {FlowSection} from './sections/flow/flow';
import {MessageEventSection} from './sections/message-event/message-event';
import {PoolSection} from './sections/pool/pool';
import {ScriptTaskSection} from './sections/script-task/script-task';
import {SignalEventSection} from './sections/signal-event/signal-event';

export class General implements IIndextab {
  public title: string = 'General';
  public path: string = '/indextabs/general/general';

  private eventBus: IEventBus;
  private elementInPanel: IModdleElement;

  public basicsSection: ISection = new BasicsSection();
  public poolSection: ISection = new PoolSection();
  public messageEventSection: ISection = new MessageEventSection();
  public signalEventSection: ISection = new SignalEventSection();
  public scriptTaskSection: ISection = new ScriptTaskSection();
  public callActivitySection: ISection = new CallActivitySection();
  public flowSection: ISection = new FlowSection();
  public errorEventSection: ISection = new ErrorEventSection();
  public escalationEventSection: ISection = new EscalationEventSection();

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
  ];

  public canHandleElement: boolean = true;

  public checkElement(element: IModdleElement): boolean {
    return true;
  }

  public activate(model: IPageModel): void {
    this.eventBus = model.modeler.get('eventBus');

    this.eventBus.on(['element.click', 'shape.changed', 'selection.changed'], (event: IEvent) => {
      if (event.type === 'element.click') {
        this.elementInPanel = event.element.businessObject;
      } else if (event.type === 'shape.changed' && event.element.type !== 'label') {
        this.elementInPanel = event.element.businessObject;
      } else if (event.type === 'selection.changed' && event.newSelection.length !== 0) {
        this.elementInPanel = event.newSelection[0].businessObject;
      }
      if (this.elementInPanel) {
        this.sections.forEach((section: ISection) => {
          section.canHandleElement = section.checkElement(this.elementInPanel);
        });
      }
    });
  }

}
