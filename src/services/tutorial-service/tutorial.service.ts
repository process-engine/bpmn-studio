import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import uuid from 'node-uuid';
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

  private activeTutorial: string = '';

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService, router: Router) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;

    this.driver = new Driver({
      allowClose: true,
      animate: false,
      showButtons: false,
      onDeselected: async (): Promise<void> => {
        this.activeTutorial = '';
      },
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
    const tutorialId: string = uuid.v4();
    this.activeTutorial = tutorialId;

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

    if (tutorialId !== this.activeTutorial) {
      return;
    }

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

    if (tutorialId !== this.activeTutorial) {
      return;
    }

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

    this.activeTutorial = '';
  };

  private startChapterTwo: Function = (): void => {
    const tutorialId: string = uuid.v4();
    this.activeTutorial = tutorialId;

    this.notificationService.showNotification(NotificationType.INFO, 'This chapter is not yet implemented.');

    this.activeTutorial = '';
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
    const waitingForNavigationPromise = this.waitForNavigation();

    this.router.navigateToRoute('start-page');

    await waitingForNavigationPromise;
  }

  private waitForNavigation(): Promise<void> {
    return new Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce('router:navigation:success', () => {
        resolve();
      });
    });
  }
}
