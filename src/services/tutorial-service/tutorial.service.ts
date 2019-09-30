import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';
import * as Bluebird from 'bluebird';

import {NotificationService} from '../notification-service/notification.service';
import environment from '../../environment';
import {Chapter, NotificationType} from '../../contracts/index';

Bluebird.Promise.config({cancellation: true});

@inject(EventAggregator, 'NotificationService', Router)
export class TutorialService {
  private driver: Driver;
  private eventAggregator: EventAggregator;
  private router: Router;
  private notificationService: NotificationService;
  private chapters: Array<Chapter> = [];

  private activePromise: any;

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService, router: Router) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;

    this.driver = new Driver({
      allowClose: true,
      animate: false,
      showButtons: false,
      padding: 2,
      onDeselected: async (): Promise<void> => {
        this.activePromise.cancel();
      },
    });

    this.initializeChapters();
  }

  public getAllChapters(): Array<Chapter> {
    return this.chapters;
  }

  public getChapter(index): Chapter {
    return this.chapters[index];
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
    this.activePromise = this.navigateToStartView();
    await this.activePromise;

    const openDiagramElementId: string = '#open-a-diagram-button';
    const deployDiagramElementId: string = '#deploy-diagram-button';
    const startDiagramElementId: string = '#start-diagram-button';

    this.driver.highlight({
      element: openDiagramElementId,
      popover: {
        title: 'Open a diagram',
        description: 'At first you need to open a new diagram via this button.',
      },
    });

    this.activePromise = this.waitUntilDiagramIsOpen();
    await this.activePromise;

    this.activePromise = this.waitUntilOverlayIsGone();
    await this.activePromise;

    this.driver.highlight({
      element: deployDiagramElementId,
      popover: {
        title: 'Deploy the diagram',
        description: 'Then deploy the diagram to a remote solution, by pressing this button.',
        position: 'left',
      },
    });

    this.activePromise = this.waitUntilDiagramIsDeployed();
    await this.activePromise;

    this.activePromise = this.waitUntilOverlayIsGone();
    await this.activePromise;

    this.driver.highlight({
      element: startDiagramElementId,
      popover: {
        title: 'Start the diagram',
        description: 'As soon as the diagram is deployed to the remote solution, it can be started.',
        position: 'left',
      },
    });

    this.activePromise = this.waitUntilDiagramIsStarted();
    await this.activePromise;
    this.driver.reset();
    this.activePromise = this.waitUntilOverlayIsGone();
    await this.activePromise;
  };

  private startChapterTwo: Function = (): void => {
    this.notificationService.showNotification(NotificationType.INFO, 'This chapter is not yet implemented.');
  };

  private waitUntilDiagramIsOpen(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramOpened, () => {
        resolve();
      });
    });
  }

  private waitUntilDiagramIsDeployed(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramDeployed, () => {
        resolve();
      });
    });
  }

  private waitUntilDiagramIsStarted(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramStarted, () => {
        resolve();
      });
    });
  }

  private waitUntilOverlayIsGone(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  }

  private async navigateToStartView(): Promise<void> {
    const isAlreadyOnStartPage: boolean = this.router.currentInstruction.config.name === 'start-page';
    if (isAlreadyOnStartPage) {
      return undefined;
    }

    const waitingForNavigationPromise = this.waitForNavigation();

    this.router.navigateToRoute('start-page');

    return waitingForNavigationPromise;
  }

  private waitForNavigation(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce('router:navigation:success', () => {
        resolve();
      });
    });
  }
}
