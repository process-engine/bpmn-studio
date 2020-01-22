import {EventAggregator} from 'aurelia-event-aggregator';
import {Router} from 'aurelia-router';

import Driver from 'driver.js';

import {NotificationService} from '../../services/notification-service/notification.service';
import {Tutorial} from './tutorial';
import {NotificationType} from '../../contracts/index';

const name: string = 'Load, Deploy and Start';

export class LoadDeployStartTutorial extends Tutorial {
  private activePromise: any;

  constructor(
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    router: Router,
    driver: Driver,
  ) {
    super(name, notificationService, eventAggregator, router, driver);
  }

  public async start(): Promise<void> {
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

    this.activePromise = this.waitForElementToBecomeVisible(startDiagramElementId);
    await this.activePromise;

    this.driver.highlight({
      element: startDiagramElementId,
      popover: {
        title: 'Start the diagram',
        description:
          'As soon as a diagram from a remote solution is opened, it can be started.<br>Click on this button to start the diagram.',
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
      `Good job! You finished the '${this.name}' tutorial.`,
    );
  }

  public cancel(): void {
    this.driver.reset();
    this.activePromise.cancel();
  }
}
