import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';

import {NotificationService} from '../notification-service/notification.service';
import environment from '../../environment';
import {NotificationType} from '../../contracts/index';

@inject(EventAggregator, 'NotificationService')
export class TutorialService {
  private driver: Driver;
  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;

    this.driver = new Driver({
      allowClose: false,
      animate: false,
      showButtons: false,
      // onDeselected: async (element: Driver.Element): Promise<void> => {
      //   await this.waitUntillOverlayIsGone();

      //   const elementId: string = (element as any).options.element;
      //   const title: string = element.getPopover().getTitleNode().textContent;
      //   const description: string = element.getPopover().getDescriptionNode().textContent;
      //   const position: string = (element as any).options.popover.position;
      //   this.driver.highlight({
      //     element: elementId,
      //     popover: {
      //       title: title,
      //       description: description,
      //       position: position,
      //     },
      //   });

      //   this.notificationService.showNotification(NotificationType.ERROR, 'You are not done yet!');
      // },
    });
  }

  public async startTutorial(): Promise<void> {
    const openDiagramElementId: string = '#open-a-diagram-button';
    const deployDiagramElementId: string = '#deploy-diagram-button';
    const startDiagramElementId: string = '#start-diagram-button';

    // TODO Disable Click outside highlighted area

    this.driver.highlight({
      element: openDiagramElementId,
      popover: {
        title: 'Open a diagram',
        description: 'At first you need to open a new diagram via this button.',
      },
    });

    await this.waitUntilDiagramIsOpen();
    this.driver.reset();
    await this.waitUntilOverlayIsGone();

    this.driver.highlight({
      element: deployDiagramElementId,
      popover: {
        title: 'Deploy the diagram',
        description: 'Then deploy the diagram to a remote solution, by pressing this button.',
        position: 'left',
      },
    });

    await this.waitUntilDiagramIsDeployed();
    this.driver.reset();
    await this.waitUntilOverlayIsGone();

    this.driver.highlight({
      element: startDiagramElementId,
      popover: {
        title: 'Start the diagram',
        description: 'As soon as the diagram is deployed to the remote solution, it can be started.',
        position: 'left',
      },
    });

    await this.waitUntilDiagramIsStarted();
    this.driver.reset();
    await this.waitUntilOverlayIsGone();
  }

  private waitUntilDiagramIsOpen(): Promise<void> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramOpened, () => {
        resolve();
      });
    });
  }

  private waitUntilDiagramIsDeployed(): Promise<void> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramDeployed, () => {
        resolve();
      });
    });
  }

  private waitUntilDiagramIsStarted(): Promise<void> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramStarted, () => {
        resolve();
      });
    });
  }

  private waitUntilOverlayIsGone(): Promise<void> {
    return new Promise((resolve: Function): void => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  }
}
