import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';

import * as Bluebird from 'bluebird';

import {NotificationService} from '../../services/notification-service/notification.service';
import environment from '../../environment';

export abstract class Tutorial {
  public name: string;

  protected notificationService: NotificationService;
  protected eventAggregator: EventAggregator;
  protected router: Router;
  protected driver: Driver;

  constructor(
    name: string,
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    router: Router,
    driver: Driver,
  ) {
    this.name = name;
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;
    this.driver = driver;
  }

  public abstract async start(): Promise<void>;
  public abstract cancel(): void;

  protected cancelTutorialIfClickWasOutsideOfHighlightedArea: (mouseEvent: MouseEvent) => void = (
    mouseEvent: MouseEvent,
  ) => {
    const clickedInHighlightedArea: boolean = this.checkIfMouseClickWasInHighlightedArea(mouseEvent);
    if (clickedInHighlightedArea) {
      return;
    }

    this.cancel();

    document.removeEventListener('click', this.cancelTutorialIfClickWasOutsideOfHighlightedArea);
  };

  protected checkIfMouseClickWasInHighlightedArea(mouseEvent: MouseEvent): boolean {
    const highlightedArea: HTMLElement = document.getElementById('driver-highlighted-element-stage');

    if (!highlightedArea) {
      return true;
    }

    const clickedInsideHighlightedElementArea: boolean =
      highlightedArea.getBoundingClientRect().left <= mouseEvent.x &&
      highlightedArea.getBoundingClientRect().right >= mouseEvent.x &&
      highlightedArea.getBoundingClientRect().top <= mouseEvent.y &&
      highlightedArea.getBoundingClientRect().bottom >= mouseEvent.y;

    return clickedInsideHighlightedElementArea;
  }

  protected hideAllModals(): void {
    this.eventAggregator.publish(environment.events.hideAllModals);
  }

  protected waitUntilDiagramIsOpen(cancelCallback?: Function): Promise<void> {
    return new Bluebird.Promise((resolve: Function, reject: Function, onCancel: Function): void => {
      const subscription: Subscription = this.eventAggregator.subscribeOnce(
        environment.events.tutorial.diagramOpened,
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

  protected waitUntilDiagramIsDeployed(cancelCallback?: Function): Promise<void> {
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

  protected waitUntilDiagramIsStarted(cancelCallback?: Function): Promise<void> {
    return new Bluebird.Promise((resolve: Function, reject: Function, onCancel: Function): void => {
      const subscription: Subscription = this.eventAggregator.subscribeOnce(
        environment.events.tutorial.diagramStarted,
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

  protected waitUntilOverlayIsGone(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  }

  protected async navigateToStartView(): Promise<void> {
    const isAlreadyOnStartPage: boolean = this.router.currentInstruction.config.name === 'start-page';
    if (isAlreadyOnStartPage) {
      return undefined;
    }

    const waitingForNavigationPromise = this.waitForNavigation();

    this.router.navigateToRoute('start-page');

    return waitingForNavigationPromise;
  }

  protected waitForNavigation(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce('router:navigation:success', () => {
        resolve();
      });
    });
  }

  protected waitForMultipleConnectedProcessEnginesModalToStart(): Promise<void> {
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

  protected waitForMultipleConnectedProcessEnginesModalToFinish(): Promise<boolean> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(
        environment.events.tutorial.multipleConnectedProcessEnginesModalFinished,
        (success: boolean) => {
          resolve(success);
        },
      );
    });
  }

  protected waitForDiagramAlreadyExistsModalToStart(): Promise<void> {
    return new Bluebird.Promise((resolve: Function): void => {
      this.eventAggregator.subscribeOnce(environment.events.tutorial.diagramAlreadyExistsModalStarted, () => {
        setTimeout(() => {
          resolve();
        }, 0);
      });
    });
  }

  protected waitForDiagramAlreadyExistsModalToFinish(): Promise<boolean> {
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
