import {inject} from 'aurelia-framework';
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';
import 'driver.js/dist/driver.min.css';
import * as Bluebird from 'bluebird';

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

  private activePromise: any;

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService, router: Router) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;

    this.driver = new Driver({
      allowClose: false,
      animate: false,
      showButtons: false,
      padding: 0,
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
        name: 'Load, Deploy & Start',
        index: 0,
        start: this.startChapterOne,
      },
    ];
  }

  private startChapterOne: Function = async (): Promise<void> => {
    document.addEventListener('click', this.cancelTutorialIfClickWasOutsideOfHighlightedArea);
    this.hideAllModals();

    this.activePromise = this.navigateToStartView();
    await this.activePromise;

    const openDiagramElementId: string = '#open-a-diagram-button';
    const deployDiagramElementId: string = '#deploy-diagram-button';
    const startDiagramElementId: string = '#start-diagram-button';

    this.driver.highlight({
      element: openDiagramElementId,
      popover: {
        title: 'Open a diagram',
        description: 'At first you need to open a new diagram by clicking on this button.',
      },
    });

    this.activePromise = this.waitUntilDiagramIsOpen();
    await this.activePromise;

    this.driver.highlight({
      element: deployDiagramElementId,
      popover: {
        title: 'Deploy the diagram',
        description: 'Then deploy the diagram to a remote solution, by clicking on this button.',
        position: 'left',
      },
    });

    const highlightMultipleConnectedProcessEnginesModal: () => Promise<void> = async () => {
      this.driver.highlight({
        element: '#select-remote-solution-modal',
        popover: {
          title: 'Select a remote solution',
          description:
            "When multiple remote solutions are opened you have to choose a remote solution. Select a solution via the selection and click on the 'Deploy Process' button.",
        },
      });

      const modalWasCanceled: boolean = !(await this.waitForMultipleConnectedProcessEnginesModalToFinish());

      if (modalWasCanceled) {
        this.activePromise.cancel();
      }

      this.driver.reset();
    };

    const highlightDiagramAlreadyExistsModal: () => Promise<void> = async () => {
      this.driver.highlight({
        element: '#overwrite-deployed-diagram-modal',
        popover: {
          title: 'Overwrite existing diagram',
          description:
            "When a diagram with the same name already exists you have to confirm that it gets overwritten. Click on the 'Deploy' button to do so.",
        },
      });

      const modalWasCanceled: boolean = !(await this.waitForDiagramAlreadyExistsModalToFinish());

      if (modalWasCanceled) {
        this.activePromise.cancel();
      }

      this.driver.reset();
    };

    const multipleConnectedProcessEnginesModalPromise: any = this.waitForMultipleConnectedProcessEnginesModalToStart().then(
      highlightMultipleConnectedProcessEnginesModal,
    );
    const diagramAlreadyExistsModalPromise: any = this.waitForDiagramAlreadyExistsModalToStart().then(
      highlightDiagramAlreadyExistsModal,
    );

    const cancelModalPromises: () => void = () => {
      multipleConnectedProcessEnginesModalPromise.cancel();
      diagramAlreadyExistsModalPromise.cancel();
    };

    this.activePromise = this.waitUntilDiagramIsDeployed();
    await this.activePromise;

    cancelModalPromises();

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

    this.activePromise = this.waitUntilDiagramIsStarted();
    await this.activePromise;

    this.driver.reset();
    this.activePromise = this.waitUntilOverlayIsGone();
    await this.activePromise;

    document.removeEventListener('click', this.cancelTutorialIfClickWasOutsideOfHighlightedArea);

    this.notificationService.showNotification(
      NotificationType.SUCCESS,
      `Good job! You finished the '${this.chapters[0].name}' chapter of the tutorial.`,
    );
  };

  private cancelTutorialIfClickWasOutsideOfHighlightedArea: (mouseEvent: MouseEvent) => void = (
    mouseEvent: MouseEvent,
  ) => {
    const clickedInHighlightedArea: boolean = this.checkIfMouseClickWasInHighlightedArea(mouseEvent);
    if (clickedInHighlightedArea) {
      return;
    }

    this.activePromise.cancel();
    this.driver.reset();
    document.removeEventListener('click', this.cancelTutorialIfClickWasOutsideOfHighlightedArea);
  };

  private checkIfMouseClickWasInHighlightedArea(mouseEvent: MouseEvent): boolean {
    const highlightedArea: HTMLElement = document.getElementById('driver-highlighted-element-stage');

    if (!highlightedArea) {
      return true;
    }

    const highlightedAreaLeft: number = parseInt(highlightedArea.style.left.replace('px', ''));
    const highlightedAreaRight: number = highlightedAreaLeft + parseInt(highlightedArea.style.width.replace('px', ''));

    const highlightedAreaTop: number = parseInt(highlightedArea.style.top.replace('px', ''));
    const highlightedAreaBottom: number = highlightedAreaTop + parseInt(highlightedArea.style.height.replace('px', ''));

    const clickedInsideHighlightedElementArea: boolean =
      highlightedAreaLeft <= mouseEvent.x &&
      highlightedAreaRight >= mouseEvent.x &&
      highlightedAreaTop <= mouseEvent.y &&
      highlightedAreaBottom >= mouseEvent.y;

    return clickedInsideHighlightedElementArea;
  }

  private hideAllModals(): void {
    this.eventAggregator.publish(environment.events.hideAllModals);
  }

  private waitUntilDiagramIsOpen(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramOpened, () => {
        resolve();
      });
    });
  }

  private waitUntilDiagramIsDeployed(cancelCallback?: Function): Promise<void> {
    return new Bluebird.Promise((resolve: Function, reject: Function, onCancel: Function): void => {
      const subscription: Subscription = this.eventAggregator.subscribeOnce(
        environment.events.tutorial.diagramDeployed,
        () => {
          resolve();
        },
      );

      onCancel(() => {
        subscription.dispose();

        if (cancelCallback) {
          cancelCallback();
        }
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

  private waitForMultipleConnectedProcessEnginesModalToStart(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(
        environment.events.tutorial.multipleConnectedProcessEnginesModalStarted,
        () => {
          setTimeout(() => {
            resolve();
          }, 0);
        },
      );
    });
  }

  private waitForMultipleConnectedProcessEnginesModalToFinish(): Promise<boolean> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(
        environment.events.tutorial.multipleConnectedProcessEnginesModalFinished,
        (success: boolean) => {
          resolve(success);
        },
      );
    });
  }

  private waitForDiagramAlreadyExistsModalToStart(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramAlreadyExistsModalStarted, () => {
        setTimeout(() => {
          resolve();
        }, 0);
      });
    });
  }

  private waitForDiagramAlreadyExistsModalToFinish(): Promise<boolean> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(
        environment.events.tutorial.diagramAlreadyExistsModalFinished,
        (success: boolean) => {
          resolve(success);
        },
      );
    });
  }
}
