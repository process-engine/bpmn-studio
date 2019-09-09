import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';

import {NotificationService} from '../notification-service/notification.service';
import environment from '../../environment';
import {Chapter, NotificationType} from '../../contracts/index';

@inject(EventAggregator, 'NotificationService', Router)
export class TutorialService {
  private driver: Driver;
  private eventAggregator: EventAggregator;
  private router: Router;
  private notificationService: NotificationService;
  private chapters: Array<Chapter> = [];

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService, router: Router) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;

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

    this.initializeChapters();
  }

  public getAllChapters(): Array<Chapter> {
    return this.chapters;
  }

  private initializeChapters(): void {
    this.chapters = [
      {
        name: 'Chapter One: Load, Deploy & Start',
        description:
          'In this chapter you will learn how to open a diagram, deploy it on a remote solution and how to start it.',
        start: this.startChapterOne,
      },
      {
        name: 'Chapter Two: WIP',
        description: 'This chapter is not yet implemented.',
        start: this.startChapterTwo,
      },
    ];
  }

  private startChapterOne: Function = async (): Promise<void> => {
    await this.navigateToStartView();
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
  };

  private startChapterTwo: Function = (): void => {
    this.notificationService.showNotification(NotificationType.INFO, 'This chapter is not yet implemented.');
  };

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

  private async navigateToStartView(): Promise<void> {
    this.router.navigateToRoute('start-page');

    await this.waitForNavigation();
  }

  private waitForNavigation(): Promise<void> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce('router:navigation:success', () => {
        resolve();
      });
    });
  }
}
