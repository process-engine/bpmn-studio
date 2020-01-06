/* eslint-disable max-lines */
/* eslint-disable 6river/new-cap */
import {computedFrom, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import * as bundle from '@process-engine/bpmn-js-custom-bundle';

import {DataModels} from '@process-engine/management_api_contracts';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IShape} from '@process-engine/bpmn-elements_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  ICanvas,
  IElementRegistry,
  IEvent,
  IEventFunction,
  IOverlay,
  IOverlayManager,
  IOverlays,
  ISolutionEntry,
  ISolutionService,
  InspectPanelTab,
  NotificationType,
} from '../../contracts/index';

import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {TaskDynamicUi} from '../task-dynamic-ui/task-dynamic-ui';
import {ILiveExecutionTrackerService, RequestError} from './contracts/index';

type RouteParameters = {
  diagramName: string;
  solutionUri: string;
  correlationId: string;
  processInstanceId: string;
  taskId?: string;
};

const OVERLAY_WIDTH: number = 40;
const OVERLAY_HEIGHT: number = 30;
const versionRegex: RegExp = /(\d+)\.(\d+).(\d+)/;

// tslint:disable: no-magic-numbers
@inject(Router, 'NotificationService', 'SolutionService', 'LiveExecutionTrackerService')
export class LiveExecutionTracker {
  public canvasModel: HTMLElement;
  public previewCanvasModel: HTMLElement;
  public showDynamicUiModal: boolean = false;
  public showDiagramPreviewViewer: boolean = false;
  public nameOfDiagramToPreview: string;
  public dynamicUi: TaskDynamicUi;
  public liveExecutionTracker: LiveExecutionTracker = this;
  public modalStyleString: string = 'position: relative; top: 20%; bottom: 20%; width: 400px; height: 60%;';
  public contentStyleString: string = 'height: auto;';

  @observable public tokenViewerWidth: number = 250;
  public tokenViewer: HTMLElement;
  public tokenViewerResizeDiv: HTMLElement;
  public showTokenViewer: boolean = false;

  @observable public activeSolutionEntry: ISolutionEntry;
  public activeDiagram: IDiagram;
  public selectedFlowNode: IShape;
  public correlation: DataModels.Correlations.Correlation;

  public correlationId: string;
  public processModelId: string;
  public processInstanceId: string;
  public taskId: string;

  private diagramViewer: IBpmnModeler;
  private diagramPreviewViewer: IBpmnModeler;
  private elementRegistry: IElementRegistry;
  private viewerCanvas: ICanvas;
  private overlays: IOverlayManager;

  private router: Router;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;

  private xml: string;

  private processStopped: boolean = true;
  private isAttached: boolean = false;
  private parentProcessInstanceId: string;
  private parentProcessModelId: string;
  private pollingTimer: NodeJS.Timer;
  private isColorizing: boolean = false;
  private colorizeAgain: boolean = false;

  private eventListenerSubscriptions: Array<Subscription> = [];
  private overlaysWithEventListeners: Array<string> = [];

  private liveExecutionTrackerService: ILiveExecutionTrackerService;

  constructor(
    router: Router,
    notificationService: NotificationService,
    solutionService: ISolutionService,
    liveExecutionTrackerService: ILiveExecutionTrackerService,
  ) {
    this.router = router;
    this.notificationService = notificationService;
    this.solutionService = solutionService;
    this.liveExecutionTrackerService = liveExecutionTrackerService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    this.correlationId = routeParameters.correlationId;
    this.processModelId = routeParameters.diagramName;

    this.activeSolutionEntry = await this.solutionService.getSolutionEntryForUri(routeParameters.solutionUri);
    this.activeSolutionEntry.service.openSolution(routeParameters.solutionUri, this.activeSolutionEntry.identity);

    this.processInstanceId = routeParameters.processInstanceId;

    this.parentProcessInstanceId = await this.getParentProcessInstanceId();
    this.parentProcessModelId = await this.getParentProcessModelId();

    this.correlation = await this.liveExecutionTrackerService.getCorrelationById(
      this.activeSolutionEntry.identity,
      this.correlationId,
    );

    // This is needed to make sure the SolutionExplorerService is completely initiated
    setTimeout(async () => {
      this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(this.processModelId);

      const routeParameterContainsTaskId: boolean = routeParameters.taskId !== undefined;
      if (routeParameterContainsTaskId) {
        this.taskId = routeParameters.taskId;

        const emptyActivitiesInProcessInstance: DataModels.EmptyActivities.EmptyActivityList = await this.liveExecutionTrackerService.getEmptyActivitiesForProcessInstance(
          this.activeSolutionEntry.identity,
          this.processInstanceId,
        );

        const emptyActivity: DataModels.EmptyActivities.EmptyActivity = emptyActivitiesInProcessInstance.emptyActivities.find(
          (activity: DataModels.EmptyActivities.EmptyActivity) => {
            return activity.id === this.taskId;
          },
        );

        if (emptyActivity) {
          this.liveExecutionTrackerService.finishEmptyActivity(
            this.activeSolutionEntry.identity,
            this.processInstanceId,
            this.correlationId,
            emptyActivity,
          );
        } else {
          this.showDynamicUiModal = true;
        }
      }
    }, 0);
  }

  public async attached(): Promise<void> {
    this.isAttached = true;

    // Create Viewer
    this.diagramViewer = new bundle.viewer({
      additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule, bundle.MiniMap],
    });

    this.elementRegistry = this.diagramViewer.get('elementRegistry');

    this.diagramPreviewViewer = new bundle.viewer({
      additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule, bundle.MiniMap],
    });

    this.viewerCanvas = this.diagramViewer.get('canvas');
    this.overlays = this.diagramViewer.get('overlays');

    const fitViewportForDiagramViewerOnce: Function = (): void => {
      this.diagramViewer.off('import.done', fitViewportForDiagramViewerOnce);
      this.viewerCanvas.zoom('fit-viewport', 'auto');
    };
    this.diagramViewer.on('import.done', fitViewportForDiagramViewerOnce);
    this.diagramViewer.attachTo(this.canvasModel);

    this.diagramViewer.on('element.click', this.elementClickHandler);

    // Prepare modeler
    const xml: string = await this.getXml();

    const couldNotGetXml: boolean = xml === undefined;
    if (couldNotGetXml) {
      return;
    }

    // Colorize xml & Add overlays
    /*
     * Remove all colors if the diagram has already colored elements.
     * For example, if the user has some elements colored orange and is running
     * the diagram, one would think in LiveExecutionTracker that the element is
     * active although it is not active.
     */
    const uncoloredXml: string = await this.liveExecutionTrackerService.clearDiagramColors(xml);
    this.xml = uncoloredXml;

    await this.importXmlIntoDiagramViewer(uncoloredXml);

    // The version must be later than 8.1.0
    const processEngineSupportsEvents: boolean = this.checkIfProcessEngineSupportsEvents();
    if (processEngineSupportsEvents) {
      // Create Backend EventListeners
      this.eventListenerSubscriptions = await this.createBackendEventListeners();
    }

    await this.handleElementColorization();

    // Use polling if events are not supported
    const processsEngineDoesNotSupportEvents: boolean = !processEngineSupportsEvents;
    if (processsEngineDoesNotSupportEvents) {
      this.startPolling();
    }

    // Add EventListener for Resizing
    this.tokenViewerResizeDiv.addEventListener('mousedown', (mouseDownEvent: Event) => {
      const windowEvent: Event = mouseDownEvent || window.event;
      windowEvent.cancelBubble = true;

      const mousemoveFunction: IEventFunction = (mouseMoveEvent: MouseEvent): void => {
        this.resizeTokenViewer(mouseMoveEvent);
        document.getSelection().empty();
      };

      const mouseUpFunction: IEventFunction = (): void => {
        document.removeEventListener('mousemove', mousemoveFunction);
        document.removeEventListener('mouseup', mouseUpFunction);
      };

      document.addEventListener('mousemove', mousemoveFunction);
      document.addEventListener('mouseup', mouseUpFunction);
    });

    const previousTokenViewerState: boolean = JSON.parse(window.localStorage.getItem('tokenViewerLETCollapseState'));
    this.showTokenViewer = previousTokenViewerState || false;

    try {
      const processInstanceIsActive: boolean = await this.liveExecutionTrackerService.isProcessInstanceActive(
        this.activeSolutionEntry.identity,
        this.processInstanceId,
      );

      this.processStopped = !processInstanceIsActive;
    } catch (error) {
      this.processStopped = true;
    }
  }

  public async detached(): Promise<void> {
    this.isAttached = false;

    this.stopPolling();

    this.diagramViewer.clear();
    this.diagramViewer.detach();
    this.diagramViewer.destroy();

    this.diagramPreviewViewer.destroy();

    const removeSubscriptionPromises: Array<Promise<void>> = [];
    this.eventListenerSubscriptions.forEach((subscription: Subscription) => {
      const removingPromise: Promise<void> = this.liveExecutionTrackerService.removeSubscription(
        this.activeSolutionEntry.identity,
        subscription,
      );

      removeSubscriptionPromises.push(removingPromise);
    });

    await Promise.all(removeSubscriptionPromises);
    this.eventListenerSubscriptions = [];
  }

  public determineActivationStrategy(): string {
    return 'replace';
  }

  @computedFrom('processStopped')
  public get processIsActive(): boolean {
    return !this.processStopped;
  }

  @computedFrom('previousProcessModels.length')
  public get hasPreviousProcess(): boolean {
    return this.parentProcessModelId !== undefined;
  }

  public navigateBackToPreviousProcess(): void {
    this.router.navigateToRoute('live-execution-tracker', {
      correlationId: this.correlationId,
      diagramName: this.parentProcessModelId,
      solutionUri: this.activeSolutionEntry.uri,
      processInstanceId: this.parentProcessInstanceId,
    });
  }

  public closeDynamicUiModal(): void {
    this.showDynamicUiModal = false;

    this.dynamicUi.clearTasks();
  }

  public closeDiagramPreview(): void {
    this.showDiagramPreviewViewer = false;

    this.diagramPreviewViewer.clear();
    this.diagramPreviewViewer.detach();
  }

  public toggleShowTokenViewer(): void {
    this.showTokenViewer = !this.showTokenViewer;
    window.localStorage.setItem('tokenViewerLETCollapseState', JSON.stringify(this.showTokenViewer));
  }

  public async stopProcessInstance(): Promise<void> {
    this.liveExecutionTrackerService.terminateProcess(this.activeSolutionEntry.identity, this.processInstanceId);

    this.startPolling();
  }

  private checkIfProcessEngineSupportsEvents(): boolean {
    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.3.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8 || (majorVersion === 8 && minorVersion >= 3);

    return processEngineSupportsEvents;
  }

  private checkIfProcessEngineSupportsGettingFlowNodeInstances(): boolean {
    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.3.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8 || (majorVersion === 8 && minorVersion >= 3);

    return processEngineSupportsEvents;
  }

  private async getParentProcessModelId(): Promise<string> {
    const parentProcessInstanceIdNotFound: boolean = this.parentProcessInstanceId === undefined;
    if (parentProcessInstanceIdNotFound) {
      return undefined;
    }

    const parentProcessModel: DataModels.Correlations.ProcessInstance = await this.liveExecutionTrackerService.getProcessModelByProcessInstanceId(
      this.activeSolutionEntry.identity,
      this.correlationId,
      this.parentProcessInstanceId,
    );

    const parentProcessModelNotFound: boolean = parentProcessModel === undefined;
    if (parentProcessModelNotFound) {
      return undefined;
    }

    return parentProcessModel.processModelId;
  }

  private async addOverlays(): Promise<void> {
    const elementsWithError: Array<IShape> = await this.liveExecutionTrackerService.getElementsWithError(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      this.elementRegistry,
    );
    const elementsWithActiveToken: Array<IShape> = await this.liveExecutionTrackerService.getElementsWithActiveToken(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      this.elementRegistry,
    );
    const inactiveCallActivities: Array<IShape> = await this.liveExecutionTrackerService.getInactiveCallActivities(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      this.elementRegistry,
    );

    this.removeEventListenerFromOverlays();
    this.overlays.clear();

    const userAndManualTaskWithOverlays: Array<IShape> = this.addOverlaysToUserAndManualTasks(elementsWithActiveToken);
    const emptyActivityWithOverlays: Array<IShape> = this.addOverlaysToEmptyActivities(elementsWithActiveToken);
    const activeCallActivityWithOverlays: Array<IShape> = this.addOverlaysToActiveCallActivities(
      elementsWithActiveToken,
    );
    const inactiveCallActivityWithOverlays: Array<IShape> = this.addOverlaysToInactiveCallActivities(
      inactiveCallActivities,
    );
    const errorElementWithOverlays: Array<IShape> = this.addOverlaysToElementsWithError(elementsWithError);
    const elementsWithfakeOverlays: Array<IShape> = this.addOverlaysToUserAndManualTasks(elementsWithError);

    const elementsWithOverlays: Array<IShape> = [
      ...userAndManualTaskWithOverlays,
      ...emptyActivityWithOverlays,
      ...activeCallActivityWithOverlays,
      ...inactiveCallActivityWithOverlays,
      ...errorElementWithOverlays,
      ...elementsWithfakeOverlays,
    ];

    this.rearrangeOverlaysForElementWithMultipleOverlays(elementsWithOverlays);
  }

  private removeEventListenerFromOverlays(): void {
    for (const overlayId of this.overlaysWithEventListeners) {
      this.removeEventListenerFromOverlay(overlayId);
    }

    this.overlaysWithEventListeners = [];
  }

  private addEventListenerToOverlay(overlayHtmlId: string): void {
    const functionToAdd: EventListenerOrEventListenerObject = this.getEventListenerForOverlayId(overlayHtmlId);

    document.getElementById(overlayHtmlId).addEventListener('click', functionToAdd);

    this.overlaysWithEventListeners.push(overlayHtmlId);
  }

  private removeEventListenerFromOverlay(overlayHtmlId: string): void {
    const functionToRemove: EventListenerOrEventListenerObject = this.getEventListenerForOverlayId(overlayHtmlId);

    const elementWithEventListener: HTMLElement = document.getElementById(overlayHtmlId);

    const elementIsAlreadyRemoved: boolean = elementWithEventListener === null;
    if (elementIsAlreadyRemoved) {
      this.overlaysWithEventListeners.splice(this.overlaysWithEventListeners.indexOf(overlayHtmlId), 1);

      return;
    }

    elementWithEventListener.removeEventListener('click', functionToRemove);

    this.overlaysWithEventListeners.splice(this.overlaysWithEventListeners.indexOf(overlayHtmlId), 1);
  }

  private getEventListenerForOverlayId(overlayHtmlId: string): EventListenerOrEventListenerObject {
    if (overlayHtmlId.endsWith('manual-user-task')) {
      return this.handleTaskClick;
    }
    if (overlayHtmlId.endsWith('empty-activity')) {
      return this.handleEmptyActivityClick;
    }
    if (overlayHtmlId.endsWith('inactive-call-activity')) {
      return this.handleInactiveCallActivityClick;
    }
    if (overlayHtmlId.endsWith('active-call-activity')) {
      return this.handleActiveCallActivityClick;
    }
    if (overlayHtmlId.endsWith('error-element')) {
      return this.handleErrorElementClick;
    }

    return undefined;
  }

  private addOverlaysToElementsWithError(elementsWithError: Array<IShape>): Array<IShape> {
    const liveExecutionTrackerIsNotAttached: boolean = !this.isAttached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    for (const element of elementsWithError) {
      const overlayHtmlId: string = `${element.id}#error-element`;

      this.overlays.add(element, {
        position: {
          left: this.getOverlayLeftPositionForElement(element.width),
          top: this.getOverlayTopPositionForElement(element.height),
        },
        html: `<div class="let__overlay-button" id="${overlayHtmlId}" style="width: ${OVERLAY_WIDTH}px; height: ${OVERLAY_HEIGHT}px;" title="Open process instance in Inspect Correlation."><i class="fas fa-bug let__overlay-button-icon overlay__error-element"></i></div>`,
      });

      this.addEventListenerToOverlay(overlayHtmlId);
    }

    return elementsWithError;
  }

  private rearrangeOverlaysForElementWithMultipleOverlays(elementsWithOverlays: Array<IShape>): void {
    for (const element of elementsWithOverlays) {
      const elementOverlays: Array<IOverlay> = this.getOverlaysForElement(element.id);

      const elementHasMultipleOverlays: boolean = elementOverlays.length > 1;
      if (!elementHasMultipleOverlays) {
        continue;
      }

      const neededOverlayWidth: number = OVERLAY_WIDTH * elementOverlays.length;
      const leftSpacing: number = (element.width - neededOverlayWidth) / 2;

      elementOverlays.forEach((overlay: IOverlay, index: number) => {
        const overlayHtmlId: string = /id="(.*?)"/g.exec(overlay.html)[1];

        this.removeEventListenerFromOverlay(overlayHtmlId);
        this.overlays.remove(overlay.id);

        overlay.position.left = leftSpacing + OVERLAY_WIDTH * index;

        this.overlays.add(element, overlay);
        this.addEventListenerToOverlay(overlayHtmlId);
      });
    }
  }

  private getOverlayLeftPositionForElement(elementWidth: number): number {
    const elementCenterX: number = elementWidth / 2;
    const elementLeftPosition: number = elementCenterX - OVERLAY_WIDTH / 2;

    return elementLeftPosition;
  }

  private getOverlayTopPositionForElement(elementHeight: number): number {
    const elementCenterY: number = elementHeight / 2;
    const elementTopPosition: number = elementCenterY - OVERLAY_HEIGHT / 2;

    return elementTopPosition;
  }

  private getOverlaysForElement(elementId: string): Array<IOverlay> {
    const overlaysForElement: Array<IOverlay> = [];

    // eslint-disable-next-line no-underscore-dangle
    const overlays: IOverlays = this.overlays._overlays;
    const overlayIds: Array<string> = Object.keys(overlays);
    for (const overlayId of overlayIds) {
      const currentOverlay: IOverlay = overlays[overlayId];

      const isOverlayOfElement: boolean = currentOverlay.element.id === elementId;

      if (isOverlayOfElement) {
        overlaysForElement.push(currentOverlay);
      }
    }

    return overlaysForElement;
  }

  private handleErrorElementClick: (event: MouseEvent) => void = (event: MouseEvent): void => {
    const overlayHtmlId: string = (event.target as HTMLDivElement).id;
    const elementId: string = this.getElementIdByOverlayHtmlId(overlayHtmlId);

    this.router.navigateToRoute('inspect', {
      view: 'inspect-correlation',
      diagramName: this.activeDiagram.name,
      solutionUri: this.activeSolutionEntry.uri,
      processInstanceToSelect: this.processInstanceId,
      flowNodeToSelect: elementId,
      inspectPanelTabToShow: InspectPanelTab.LogViewer,
    });
  };

  private addOverlaysToEmptyActivities(elements: Array<IShape>): Array<IShape> {
    const liveExecutionTrackerIsNotAttached: boolean = !this.isAttached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeEmptyActivities: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsEmptyActivity: boolean = element.type === 'bpmn:Task';

      return elementIsEmptyActivity;
    });

    for (const element of activeEmptyActivities) {
      const overlayHtmlId: string = `${element.id}#empty-activity`;

      this.overlays.add(element, {
        position: {
          left: this.getOverlayLeftPositionForElement(element.width),
          top: this.getOverlayTopPositionForElement(element.height),
        },
        html: `<div class="let__overlay-button" id="${overlayHtmlId}" style="width: ${OVERLAY_WIDTH}px; height: ${OVERLAY_HEIGHT}px;" title="Continue empty activity."><i class="fas fa-play let__overlay-button-icon overlay__empty-task"></i></div>`,
      });

      this.addEventListenerToOverlay(overlayHtmlId);
    }

    return activeEmptyActivities;
  }

  private addOverlaysToUserAndManualTasks(elements: Array<IShape>): Array<IShape> {
    const liveExecutionTrackerIsNotAttached: boolean = !this.isAttached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeManualAndUserTasks: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsAUserOrManualTask: boolean =
        element.type === 'bpmn:UserTask' || element.type === 'bpmn:ManualTask';

      return elementIsAUserOrManualTask;
    });

    for (const element of activeManualAndUserTasks) {
      const overlayHtmlId: string = `${element.id}#manual-user-task`;

      this.overlays.add(element, {
        position: {
          left: this.getOverlayLeftPositionForElement(element.width),
          top: this.getOverlayTopPositionForElement(element.height),
        },
        html: `<div class="let__overlay-button" id="${overlayHtmlId}" style="width: ${OVERLAY_WIDTH}px; height: ${OVERLAY_HEIGHT}px;" title="Continue task."><i class="fas fa-play let__overlay-button-icon"></i></div>`,
      });

      this.addEventListenerToOverlay(overlayHtmlId);
    }

    return activeManualAndUserTasks;
  }

  private addOverlaysToInactiveCallActivities(inactiveCallActivities: Array<IShape>): Array<IShape> {
    const liveExecutionTrackerIsNotAttached: boolean = !this.isAttached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    for (const element of inactiveCallActivities) {
      const overlayHtmlId: string = `${element.id}#inactive-call-activity`;

      this.overlays.add(element, {
        position: {
          left: this.getOverlayLeftPositionForElement(element.width),
          top: this.getOverlayTopPositionForElement(element.height),
        },
        html: `<div class="let__overlay-button" id="${overlayHtmlId}" style="width: ${OVERLAY_WIDTH}px; height: ${OVERLAY_HEIGHT}px;" title="Show target process."><i class="fas fa-search let__overlay-button-icon"></i></div>`,
      });

      this.addEventListenerToOverlay(overlayHtmlId);
    }

    return inactiveCallActivities;
  }

  private addOverlaysToActiveCallActivities(activeElements: Array<IShape>): Array<IShape> {
    const liveExecutionTrackerIsNotAttached: boolean = !this.isAttached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeCallActivities: Array<IShape> = activeElements.filter((element: IShape) => {
      const elementIsCallActivity: boolean = element.type === 'bpmn:CallActivity';

      return elementIsCallActivity;
    });

    for (const element of activeCallActivities) {
      const overlayHtmlId: string = `${element.id}#active-call-activity`;

      this.overlays.add(element, {
        position: {
          left: this.getOverlayLeftPositionForElement(element.width),
          top: this.getOverlayTopPositionForElement(element.height),
        },
        html: `<div class="let__overlay-button" id="${overlayHtmlId}" style="width: ${OVERLAY_WIDTH}px; height: ${OVERLAY_HEIGHT}px;" title="Show target process."><i class="fas fa-external-link-square-alt let__overlay-button-icon"></i></div>`,
      });

      this.addEventListenerToOverlay(overlayHtmlId);
    }

    return activeCallActivities;
  }

  private handleTaskClick: (event: MouseEvent) => void = (event: MouseEvent): void => {
    const overlayHtmlId: string = (event.target as HTMLDivElement).id;
    const elementId: string = this.getElementIdByOverlayHtmlId(overlayHtmlId);

    this.taskId = elementId;
    this.showDynamicUiModal = true;
  };

  private handleEmptyActivityClick: (event: MouseEvent) => void = async (event: MouseEvent): Promise<void> => {
    const overlayHtmlId: string = (event.target as HTMLDivElement).id;
    const elementId: string = this.getElementIdByOverlayHtmlId(overlayHtmlId);

    this.taskId = elementId;

    const emptyActivitiesInProcessInstance: DataModels.EmptyActivities.EmptyActivityList = await this.liveExecutionTrackerService.getEmptyActivitiesForProcessInstance(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
    );

    const emptyActivity: DataModels.EmptyActivities.EmptyActivity = emptyActivitiesInProcessInstance.emptyActivities.find(
      (activity: DataModels.EmptyActivities.EmptyActivity) => {
        return activity.id === this.taskId;
      },
    );

    this.liveExecutionTrackerService.finishEmptyActivity(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      this.correlationId,
      emptyActivity,
    );
  };

  private handleActiveCallActivityClick: (event: MouseEvent) => Promise<void> = async (
    event: MouseEvent,
  ): Promise<void> => {
    const overlayHtmlId: string = (event.target as HTMLDivElement).id;
    const elementId: string = this.getElementIdByOverlayHtmlId(overlayHtmlId);
    const element: IShape = this.elementRegistry.get(elementId);

    const callActivityTargetProcess: string = element.businessObject.calledElement;

    const callAcitivityHasNoTargetProcess: boolean = callActivityTargetProcess === undefined;
    if (callAcitivityHasNoTargetProcess) {
      const noTargetMessage: string =
        'The CallActivity has no target configured. Please configure a target in the designer.';

      this.notificationService.showNotification(NotificationType.INFO, noTargetMessage);
    }

    const targetProcessInstanceId: string = await this.liveExecutionTrackerService.getProcessInstanceIdOfCallActivityTarget(
      this.activeSolutionEntry.identity,
      this.correlationId,
      this.processInstanceId,
      callActivityTargetProcess,
    );

    const errorGettingTargetProcessInstanceId: boolean = targetProcessInstanceId === undefined;
    if (errorGettingTargetProcessInstanceId) {
      const errorMessage: string = 'Target process of call activity not found.';

      this.notificationService.showNotification(NotificationType.ERROR, errorMessage);
      return;
    }

    this.router.navigateToRoute('live-execution-tracker', {
      diagramName: callActivityTargetProcess,
      solutionUri: this.activeSolutionEntry.uri,
      correlationId: this.correlationId,
      processInstanceId: targetProcessInstanceId,
    });
  };

  private handleInactiveCallActivityClick: (event: MouseEvent) => Promise<void> = async (
    event: MouseEvent,
  ): Promise<void> => {
    const overlayHtmlId: string = (event.target as HTMLDivElement).id;
    const elementId: string = this.getElementIdByOverlayHtmlId(overlayHtmlId);
    const element: IShape = this.elementRegistry.get(elementId);
    const callActivityTargetProcess: string = element.businessObject.calledElement;

    const callActivityHasNoTargetProcess: boolean = callActivityTargetProcess === undefined;
    if (callActivityHasNoTargetProcess) {
      const noTargetMessage: string =
        'The CallActivity has no target configured. Please configure a target in the designer.';

      this.notificationService.showNotification(NotificationType.INFO, noTargetMessage);
    }

    const xml: string = await this.getXmlByProcessModelId(callActivityTargetProcess);
    await this.importXmlIntoDiagramPreviewViewer(xml);

    this.nameOfDiagramToPreview = callActivityTargetProcess;
    this.showDiagramPreviewViewer = true;

    setTimeout(() => {
      this.diagramPreviewViewer.attachTo(this.previewCanvasModel);
    }, 0);
  };

  private async getXmlByProcessModelId(processModelId: string): Promise<string> {
    const processModel: DataModels.ProcessModels.ProcessModel = await this.liveExecutionTrackerService.getProcessModelById(
      this.activeSolutionEntry.identity,
      processModelId,
    );

    return processModel.xml;
  }

  private elementClickHandler: (event: IEvent) => Promise<void> = async (event: IEvent) => {
    const clickedElement: IShape = event.element;

    this.selectedFlowNode = event.element;

    const clickedElementIsNotAUserOrManualTask: boolean =
      clickedElement.type !== 'bpmn:UserTask' && clickedElement.type !== 'bpmn:ManualTask';

    if (clickedElementIsNotAUserOrManualTask) {
      return;
    }

    this.taskId = clickedElement.id;
  };

  private async getXml(): Promise<string> {
    const correlation: DataModels.Correlations.Correlation = await this.liveExecutionTrackerService.getCorrelationById(
      this.activeSolutionEntry.identity,
      this.correlationId,
    );

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      this.notificationService.showNotification(
        NotificationType.ERROR,
        'Could not get correlation. Please try to start the process again.',
      );

      return undefined;
    }

    const processModelFromCorrelation: DataModels.Correlations.ProcessInstance = correlation.processInstances.find(
      (processModel: DataModels.Correlations.ProcessInstance) => {
        const processModelIsSearchedProcessModel: boolean = processModel.processInstanceId === this.processInstanceId;

        return processModelIsSearchedProcessModel;
      },
    );

    const xmlFromProcessModel: string = processModelFromCorrelation.xml;

    return xmlFromProcessModel;
  }

  private async importXmlIntoDiagramViewer(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;

    if (xmlIsNotLoaded) {
      const xmlCouldNotBeLoadedMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this.notificationService.showNotification(NotificationType.ERROR, xmlCouldNotBeLoadedMessage);

      return undefined;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this.diagramViewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }

        resolve();
      });
    });

    return xmlImportPromise;
  }

  private getElementIdByOverlayHtmlId(overlayHtmlId: string): string {
    return overlayHtmlId.substring(0, overlayHtmlId.lastIndexOf('#'));
  }

  private async importXmlIntoDiagramPreviewViewer(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;

    if (xmlIsNotLoaded) {
      const xmlCouldNotBeLoadedMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this.notificationService.showNotification(NotificationType.ERROR, xmlCouldNotBeLoadedMessage);

      return undefined;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this.diagramPreviewViewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }
        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async exportXmlFromDiagramViewer(): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      const xmlSaveOptions: IBpmnXmlSaveOptions = {
        format: true,
      };

      this.diagramViewer.saveXML(xmlSaveOptions, async (saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
  }

  private async handleElementColorization(): Promise<void> {
    // This prevents the LET from Coloring several times at once
    if (this.isColorizing) {
      this.colorizeAgain = true;

      return;
    }

    this.isColorizing = true;

    const previousXml: string = await this.exportXmlFromDiagramViewer();

    const colorizedXml: string | undefined = await (async (): Promise<string | undefined> => {
      try {
        return await this.liveExecutionTrackerService.getColorizedDiagram(
          this.activeSolutionEntry.identity,
          this.xml,
          this.processInstanceId,
          this.checkIfProcessEngineSupportsGettingFlowNodeInstances(),
        );
      } catch (error) {
        const message: string = `Could not colorize XML: ${error}`;

        this.notificationService.showNotification(NotificationType.ERROR, message);
      }

      return undefined;
    })();

    const colorizingWasSuccessfull: boolean = colorizedXml !== undefined;
    const xmlChanged: boolean = previousXml !== colorizedXml;
    if (xmlChanged && colorizingWasSuccessfull) {
      await this.importXmlIntoDiagramViewer(colorizedXml);
      await this.addOverlays();
    }

    this.isColorizing = false;

    // If the colorization was triggered while colorizing, the colorization needs to be repeated as soon as it is finished
    if (this.colorizeAgain) {
      this.colorizeAgain = false;

      this.handleElementColorization();
    }
  }

  private async getParentProcessInstanceId(): Promise<string> {
    const correlation: DataModels.Correlations.Correlation = await this.liveExecutionTrackerService.getCorrelationById(
      this.activeSolutionEntry.identity,
      this.correlationId,
    );

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processInstanceFromCorrelation: DataModels.Correlations.ProcessInstance = correlation.processInstances.find(
      (processInstance: DataModels.Correlations.ProcessInstance): boolean => {
        const processInstanceFound: boolean = processInstance.processInstanceId === this.processInstanceId;

        return processInstanceFound;
      },
    );

    const {parentProcessInstanceId} = processInstanceFromCorrelation;

    return parentProcessInstanceId;
  }

  private createBackendEventListeners(): Promise<Array<Subscription>> {
    const processEndedCallback: Function = (): void => {
      this.handleElementColorization();

      this.sendProcessStoppedNotification();
    };

    const colorizationCallback: Function = (): void => {
      this.handleElementColorization();
    };

    const processEndedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createProcessEndedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      processEndedCallback,
    );
    const processErrorSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createProcessErrorEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      processEndedCallback,
    );
    const processTerminatedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createProcessTerminatedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      processEndedCallback,
    );

    const userTaskWaitingSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createUserTaskWaitingEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const userTaskFinishedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createUserTaskFinishedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const manualTaskWaitingSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createManualTaskWaitingEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const manualTaskFinishedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createManualTaskFinishedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const emptyActivityWaitingSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createEmptyActivityWaitingEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const emptyActivityFinishedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createEmptyActivityFinishedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const activityReachedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createActivityReachedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const activityFinishedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createActivityFinishedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const boundaryEventTriggeredSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createBoundaryEventTriggeredEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const intermediateThrowEventTriggeredSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createIntermediateThrowEventTriggeredEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const intermediateCatchEventReachedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createIntermediateCatchEventReachedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );
    const intermediateCatchEventFinishedSubscriptionPromise: Promise<Subscription> = this.liveExecutionTrackerService.createIntermediateCatchEventFinishedEventListener(
      this.activeSolutionEntry.identity,
      this.processInstanceId,
      colorizationCallback,
    );

    const subscriptionPromises: Array<Promise<Subscription>> = [
      processEndedSubscriptionPromise,
      processErrorSubscriptionPromise,
      processTerminatedSubscriptionPromise,
      userTaskWaitingSubscriptionPromise,
      userTaskFinishedSubscriptionPromise,
      manualTaskWaitingSubscriptionPromise,
      manualTaskFinishedSubscriptionPromise,
      emptyActivityWaitingSubscriptionPromise,
      emptyActivityFinishedSubscriptionPromise,
      activityReachedSubscriptionPromise,
      activityFinishedSubscriptionPromise,
      boundaryEventTriggeredSubscriptionPromise,
      intermediateThrowEventTriggeredSubscriptionPromise,
      intermediateCatchEventReachedSubscriptionPromise,
      intermediateCatchEventFinishedSubscriptionPromise,
    ];

    return Promise.all(subscriptionPromises);
  }

  private startPolling(): void {
    this.pollingTimer = setTimeout(async () => {
      // Stop polling if not attached
      const notAttached: boolean = !this.isAttached;
      if (notAttached) {
        return;
      }

      const isProcessInstanceActive: Function = async (): Promise<boolean> => {
        try {
          return await this.liveExecutionTrackerService.isProcessInstanceActive(
            this.activeSolutionEntry.identity,
            this.processInstanceId,
          );
        } catch (error) {
          const connectionLost: boolean = error === RequestError.ConnectionLost;
          // Keep polling if connection is lost
          if (connectionLost) {
            this.startPolling();
          } else {
            const notificationMessage: string =
              'Could not get active correlations. Please try to start the process again.';

            this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);
          }

          return false;
        }
      };

      await this.handleElementColorization();

      const processInstanceIsActive: boolean = await isProcessInstanceActive();

      const processInstanceIsNotActive: boolean = processInstanceIsActive === false;
      if (processInstanceIsNotActive) {
        this.sendProcessStoppedNotification();

        return;
      }

      this.startPolling();
    }, environment.processengine.liveExecutionTrackerPollingIntervalInMs);
  }

  private stopPolling(): void {
    clearTimeout(this.pollingTimer);
  }

  private sendProcessStoppedNotification(): void {
    this.processStopped = true;

    this.notificationService.showNotification(NotificationType.INFO, 'Process stopped.');
  }

  private resizeTokenViewer(mouseEvent: MouseEvent): void {
    const mouseXPosition: number = mouseEvent.clientX;

    const liveExecutionTracker: HTMLElement = this.tokenViewer.parentElement;

    const minSpaceForDiagramViewer: number = 320;

    const windowWidth: number = window.innerWidth;
    const rightToolbarWidth: number = 36;

    const minTokenViewerWidth: number = 250;
    const maxTokenViewerWidth: number = liveExecutionTracker.clientWidth - minSpaceForDiagramViewer;

    const newTokenViewerWidth: number = windowWidth - mouseXPosition - rightToolbarWidth;

    /*
     * This sets the new width of the token viewer to the minimum or maximum width,
     * if the new width is smaller than the minimum or bigger than the maximum width.
     */
    this.tokenViewerWidth = Math.min(maxTokenViewerWidth, Math.max(newTokenViewerWidth, minTokenViewerWidth));
  }
}
