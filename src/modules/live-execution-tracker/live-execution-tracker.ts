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
  IEvent,
  IEventFunction,
  IOverlayManager,
  ISolutionEntry,
  ISolutionService,
  NotificationType,
} from '../../contracts/index';

import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {TaskDynamicUi} from '../task-dynamic-ui/task-dynamic-ui';
import {ILiveExecutionTrackerService, RequestError} from './contracts/index';

type RouteParameters = {
  diagramName: string,
  solutionUri: string,
  correlationId: string,
  processInstanceId: string,
  taskId?: string,
};

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

  private _diagramViewer: IBpmnModeler;
  private _diagramPreviewViewer: IBpmnModeler;
  private _viewerCanvas: ICanvas;
  private _overlays: IOverlayManager;

  private _router: Router;
  private _notificationService: NotificationService;
  private _solutionService: ISolutionService;

  private _processStopped: boolean = false;
  private _attached: boolean = false;
  private _parentProcessInstanceId: string;
  private _parentProcessModelId: string;
  private _activeCallActivities: Array<IShape> = [];
  private _pollingTimer: NodeJS.Timer;
  private _isColorizing: boolean = false;
  private _colorizeAgain: boolean = false;

  private _eventListenerSubscriptions: Array<Subscription> = [];

  private _elementsWithEventListeners: Array<string> = [];

  private _liveExecutionTrackerService: ILiveExecutionTrackerService;

  constructor(router: Router,
              notificationService: NotificationService,
              solutionService: ISolutionService,
              liveExecutionTrackerService: ILiveExecutionTrackerService) {

    this._router = router;
    this._notificationService = notificationService;
    this._solutionService = solutionService;
    this._liveExecutionTrackerService = liveExecutionTrackerService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    this.correlationId = routeParameters.correlationId;
    this.processModelId = routeParameters.diagramName;

    this.activeSolutionEntry = await this._solutionService.getSolutionEntryForUri(routeParameters.solutionUri);
    this.activeSolutionEntry.service.openSolution(routeParameters.solutionUri, this.activeSolutionEntry.identity);

    this.processInstanceId = routeParameters.processInstanceId;

    this._parentProcessInstanceId = await this._getParentProcessInstanceId();
    this._parentProcessModelId = await this._getParentProcessModelId();

    this.correlation = await this._liveExecutionTrackerService.getCorrelationById(this.correlationId);

    // This is needed to make sure the SolutionExplorerService is completely initiated
    setTimeout(async() => {
      this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(this.processModelId);

      const routeParameterContainsTaskId: boolean = routeParameters.taskId !== undefined;
      if (routeParameterContainsTaskId) {
        this.taskId = routeParameters.taskId;

        const emptyActivitiesInProcessInstance: DataModels.EmptyActivities.EmptyActivityList =
          await this._liveExecutionTrackerService.getEmptyActivitiesForProcessInstance(this.processInstanceId);

        const emptyActivity: DataModels.EmptyActivities.EmptyActivity =
          emptyActivitiesInProcessInstance.emptyActivities.find((activity: DataModels.EmptyActivities.EmptyActivity) => {
            return activity.id === this.taskId;
        });

        if (emptyActivity) {
          this._liveExecutionTrackerService.finishEmptyActivity(this.processInstanceId, this.correlationId, emptyActivity);
        } else {
          this.showDynamicUiModal = true;
        }
      }
    }, 0);
  }

  public async attached(): Promise<void> {
    this._attached = true;

    // Create Viewer
    this._diagramViewer = new bundle.viewer({
      additionalModules:
        [
          bundle.ZoomScrollModule,
          bundle.MoveCanvasModule,
          bundle.MiniMap,
        ],
    });

    this._diagramPreviewViewer = new bundle.viewer({
      additionalModules:
      [
        bundle.ZoomScrollModule,
        bundle.MoveCanvasModule,
        bundle.MiniMap,
      ],
    });

    this._viewerCanvas = this._diagramViewer.get('canvas');
    this._overlays = this._diagramViewer.get('overlays');

    const fitViewportForDiagramViewerOnce: Function = (): void => {
      this._diagramViewer.off('import.done', fitViewportForDiagramViewerOnce);
      this._viewerCanvas.zoom('fit-viewport', 'auto');
    };
    this._diagramViewer.on('import.done', fitViewportForDiagramViewerOnce);
    this._diagramViewer.attachTo(this.canvasModel);

    this._diagramViewer.on('element.click', this._elementClickHandler);

    // Prepare modeler
    const xml: string = await this._getXml();

    const couldNotGetXml: boolean = xml === undefined;
    if (couldNotGetXml) {
      return;
    }

    // Import the xml to the modeler to add colors to it
    await this._liveExecutionTrackerService.importXmlIntoDiagramModeler(xml);

    // Colorize xml & Add overlays
    /*
     * Remove all colors if the diagram has already colored elements.
     * For example, if the user has some elements colored orange and is running
     * the diagram, one would think in LiveExecutionTracker that the element is
     * active although it is not active.
    */
    this._liveExecutionTrackerService.clearDiagramColors();

    // Import the xml without colors to DiagramViewer
    const xmlFromModeler: string = await this._liveExecutionTrackerService.exportXmlFromDiagramModeler();
    await this._importXmlIntoDiagramViewer(xmlFromModeler);

    // The version must be later than 8.1.0
    const processEngineSupportsEvents: boolean = this._checkIfProcessEngineSupportsEvents();
    if (processEngineSupportsEvents) {
      // Create Backend EventListeners
      this._eventListenerSubscriptions = await this._createBackendEventListeners();
    }

    await this._handleElementColorization();

    // Use polling if events are not supported
    const processsEngineDoesNotSupportEvents: boolean = !processEngineSupportsEvents;
    if (processsEngineDoesNotSupportEvents) {
      this._startPolling();
    }

    // Add EventListener for Resizing
    this.tokenViewerResizeDiv.addEventListener('mousedown', (mouseDownEvent: Event) => {
      const windowEvent: Event = mouseDownEvent || window.event;
      windowEvent.cancelBubble = true;

      const mousemoveFunction: IEventFunction = (mouseMoveEvent: MouseEvent): void => {
        this._resizeTokenViewer(mouseMoveEvent);
        document.getSelection().empty();
      };

      const mouseUpFunction: IEventFunction = (): void => {
        document.removeEventListener('mousemove', mousemoveFunction);
        document.removeEventListener('mouseup', mouseUpFunction);
      };

      document.addEventListener('mousemove', mousemoveFunction);
      document.addEventListener('mouseup', mouseUpFunction);
    });
  }

  public async detached(): Promise<void> {
    this._attached = false;

    this._stopPolling();

    this._diagramViewer.clear();
    this._diagramViewer.detach();
    this._diagramViewer.destroy();

    this._diagramPreviewViewer.destroy();

    const removeSubscriptionPromises: Array<Promise<void>> = [];
    this._eventListenerSubscriptions.forEach((subscription: Subscription) => {
      const removingPromise: Promise<void> = this._liveExecutionTrackerService.removeSubscription(subscription);

      removeSubscriptionPromises.push(removingPromise);
    });

    await Promise.all(removeSubscriptionPromises);
    this._eventListenerSubscriptions = [];
  }

  public determineActivationStrategy(): string {
    return 'replace';
  }

  public activeSolutionEntryChanged(): void {
    this._liveExecutionTrackerService.setIdentity(this.activeSolutionEntry.identity);
  }

  @computedFrom('_processStopped')
  public get processIsActive(): boolean {
    return !this._processStopped;
  }

  @computedFrom('_previousProcessModels.length')
  public get hasPreviousProcess(): boolean {
    return this._parentProcessModelId !== undefined;
  }

  public navigateBackToPreviousProcess(): void {
    this._router.navigateToRoute('live-execution-tracker', {
      correlationId: this.correlationId,
      diagramName: this._parentProcessModelId,
      solutionUri: this.activeSolutionEntry.uri,
      processInstanceId: this._parentProcessInstanceId,
    });
  }

  public closeDynamicUiModal(): void {
    this.showDynamicUiModal = false;

    this.dynamicUi.clearTasks();
  }

  public closeDiagramPreview(): void {
    this.showDiagramPreviewViewer = false;

    this._diagramPreviewViewer.clear();
    this._diagramPreviewViewer.detach();
  }

  public toggleShowTokenViewer(): void {
    this.showTokenViewer = !this.showTokenViewer;
  }

  public async stopProcessInstance(): Promise<void> {
    this._liveExecutionTrackerService.terminateProcess(this.processInstanceId);

    this._startPolling();
  }

  private _checkIfProcessEngineSupportsEvents(): boolean {

    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.3.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8
                                              || (majorVersion === 8
                                               && minorVersion >= 3);

    return processEngineSupportsEvents;
  }

  private _checkIfProcessEngineSupportsGettingFlowNodeInstances(): boolean {

    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.3.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8
                                              || (majorVersion === 8
                                               && minorVersion >= 3);

    return processEngineSupportsEvents;
  }

  private async _getParentProcessModelId(): Promise<string> {
    const parentProcessInstanceIdNotFound: boolean = this._parentProcessInstanceId === undefined;
    if (parentProcessInstanceIdNotFound) {
      return undefined;
    }

    const parentProcessModel: DataModels.Correlations.CorrelationProcessInstance =
     await this._liveExecutionTrackerService.getProcessModelByProcessInstanceId(this.correlationId, this._parentProcessInstanceId);

    const parentProcessModelNotFound: boolean = parentProcessModel === undefined;
    if (parentProcessModelNotFound) {
      return undefined;
    }

    return parentProcessModel.processModelId;
  }

  private async _addOverlays(): Promise<void> {

    this._overlays.clear();

    const elementsWithActiveToken: Array<IShape> = await this._liveExecutionTrackerService.getElementsWithActiveToken(this.processInstanceId);
    const inactiveCallActivities: Array<IShape> = await this._liveExecutionTrackerService.getInactiveCallActivities(this.processInstanceId);

    this._addOverlaysToUserAndManualTasks(elementsWithActiveToken);
    this._addOverlaysToEmptyActivities(elementsWithActiveToken);
    this._addOverlaysToActiveCallActivities(elementsWithActiveToken);
    this._addOverlaysToInactiveCallActivities(inactiveCallActivities);
  }

  private _addOverlaysToEmptyActivities(elements: Array<IShape>): Array<string> {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeEmptyActivities: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsEmptyActivity: boolean = element.type === 'bpmn:Task';

      return elementIsEmptyActivity;
    });

    const activeEmptyActivitiesIds: Array<string> = activeEmptyActivities.map((element: IShape) => element.id).sort();

    for (const elementId of this._elementsWithEventListeners) {
      document.getElementById(elementId).removeEventListener('click', this._handleEmptyActivityClick);
    }

    for (const callActivity of this._activeCallActivities) {
      document.getElementById(callActivity.id).removeEventListener('click', this._handleActiveCallActivityClick);
    }

    this._elementsWithEventListeners = [];

    for (const element of activeEmptyActivities) {
      this._overlays.add(element, {
        position: {
          left: 30,
          top: 25,
        },
        html: `<div class="let__overlay-button" id="${element.id}"><i class="fas fa-play let__overlay-button-icon overlay__empty-task"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleEmptyActivityClick);

      this._elementsWithEventListeners.push(element.id);
    }

    return activeEmptyActivitiesIds;
  }

  private _addOverlaysToUserAndManualTasks(elements: Array<IShape>): Array<string> {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeManualAndUserTasks: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsAUserOrManualTask: boolean = element.type === 'bpmn:UserTask'
                                               || element.type === 'bpmn:ManualTask';

      return elementIsAUserOrManualTask;
    });

    const activeManualAndUserTaskIds: Array<string> = activeManualAndUserTasks.map((element: IShape) => element.id).sort();

    for (const elementId of this._elementsWithEventListeners) {
      document.getElementById(elementId).removeEventListener('click', this._handleTaskClick);
    }

    for (const callActivity of this._activeCallActivities) {
      document.getElementById(callActivity.id).removeEventListener('click', this._handleActiveCallActivityClick);
    }

    this._elementsWithEventListeners = [];

    for (const element of activeManualAndUserTasks) {
      this._overlays.add(element, {
        position: {
          left: 30,
          top: 25,
        },
        html: `<div class="let__overlay-button" id="${element.id}"><i class="fas fa-play let__overlay-button-icon"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleTaskClick);

      this._elementsWithEventListeners.push(element.id);
    }

    return activeManualAndUserTaskIds;
  }

  private _addOverlaysToInactiveCallActivities(callActivities: Array<IShape>): void {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return;
    }

    const callActivityIds: Array<string> = callActivities.map((element: IShape) => element.id).sort();

    const overlayIds: Array<string> = Object.keys(this._overlays._overlays);
    const allCallActivitiesHaveAnOverlay: boolean = callActivityIds.every((callActivityId: string): boolean => {
      const overlayFound: boolean = overlayIds.find((overlayId: string): boolean => {
        return this._overlays._overlays[overlayId].element.id === callActivityId;
      }) !== undefined;

      return overlayFound;
     });

    if (allCallActivitiesHaveAnOverlay) {
      return;
    }

    for (const element of callActivities) {
      this._overlays.add(element, {
        position: {
          left: 30,
          top: 25,
        },
        html: `<div class="let__overlay-button" id="${element.id}"><i class="fas fa-search let__overlay-button-icon"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleInactiveCallActivityClick);

      this._elementsWithEventListeners.push(element.id);
    }
  }

  private _addOverlaysToActiveCallActivities(activeElements: Array<IShape>): Array<string> {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return [];
    }

    const activeCallActivities: Array<IShape> = activeElements.filter((element: IShape) => {
      const elementIsCallActivity: boolean = element.type === 'bpmn:CallActivity';

      return elementIsCallActivity;
    });

    const activeCallActivityIds: Array<string> = activeCallActivities.map((element: IShape) => element.id).sort();

    this._activeCallActivities = activeCallActivities;

    for (const element of activeCallActivities) {
      this._overlays.add(element, {
        position: {
          left: 30,
          top: 25,
        },
        html: `<div class="let__overlay-button" id="${element.id}"><i class="fas fa-external-link-square-alt let__overlay-button-icon"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleActiveCallActivityClick);

      this._elementsWithEventListeners.push(element.id);
    }

    return activeCallActivityIds;
  }

  private _handleTaskClick: (event: MouseEvent) => void =
    (event: MouseEvent): void => {
      const elementId: string = (event.target as HTMLDivElement).id;
      this.taskId = elementId;
      this.showDynamicUiModal = true;
    }

  private _handleEmptyActivityClick: (event: MouseEvent) => void =
    async(event: MouseEvent): Promise<void> => {
      const elementId: string = (event.target as HTMLDivElement).id;
      this.taskId = elementId;

      const emptyActivitiesInProcessInstance: DataModels.EmptyActivities.EmptyActivityList =
        await this._liveExecutionTrackerService.getEmptyActivitiesForProcessInstance(this.processInstanceId);

      const emptyActivity: DataModels.EmptyActivities.EmptyActivity =
        emptyActivitiesInProcessInstance.emptyActivities.find((activity: DataModels.EmptyActivities.EmptyActivity) => {
          return activity.id === this.taskId;
      });

      this._liveExecutionTrackerService.finishEmptyActivity(this.processInstanceId, this.correlationId, emptyActivity);
    }

  private _handleActiveCallActivityClick: (event: MouseEvent) => Promise<void> =
    async(event: MouseEvent): Promise<void> => {
      const elementId: string = (event.target as HTMLDivElement).id;
      const element: IShape = this._liveExecutionTrackerService.getElementById(elementId);
      const callActivityTargetProcess: string = element.businessObject.calledElement;

      const callAcitivityHasNoTargetProcess: boolean = callActivityTargetProcess === undefined;
      if (callAcitivityHasNoTargetProcess) {
        const noTargetMessage: string = 'The CallActivity has no target configured. Please configure a target in the designer.';

        this._notificationService.showNotification(NotificationType.INFO, noTargetMessage);
      }

      const targetProcessInstanceId: string =
        await this._liveExecutionTrackerService.getProcessInstanceIdOfCallActivityTarget(this.correlationId,
                                                                                         this.processInstanceId,
                                                                                         callActivityTargetProcess);

      const errorGettingTargetProcessInstanceId: boolean = targetProcessInstanceId === undefined;
      if (errorGettingTargetProcessInstanceId) {
        const errorMessage: string = 'Could not get processInstanceId of the target process. Please try to click on the call activity again.';

        this._notificationService.showNotification(NotificationType.ERROR, errorMessage);
        return;
      }

      this._router.navigateToRoute('live-execution-tracker', {
        diagramName: callActivityTargetProcess,
        solutionUri: this.activeSolutionEntry.uri,
        correlationId: this.correlationId,
        processInstanceId: targetProcessInstanceId,
      });
    }

    private _handleInactiveCallActivityClick: (event: MouseEvent) => Promise<void> =
    async(event: MouseEvent): Promise<void> => {
      const elementId: string = (event.target as HTMLDivElement).id;
      const element: IShape = this._liveExecutionTrackerService.getElementById(elementId);
      const callActivityTargetProcess: string = element.businessObject.calledElement;

      const callActivityHasNoTargetProcess: boolean = callActivityTargetProcess === undefined;
      if (callActivityHasNoTargetProcess) {
        const noTargetMessage: string = 'The CallActivity has no target configured. Please configure a target in the designer.';

        this._notificationService.showNotification(NotificationType.INFO, noTargetMessage);
      }

      const xml: string = await this._getXmlByProcessModelId(callActivityTargetProcess);
      await this._importXmlIntoDiagramPreviewViewer(xml);

      this.nameOfDiagramToPreview = callActivityTargetProcess;
      this.showDiagramPreviewViewer = true;

      setTimeout(() => {
        this._diagramPreviewViewer.attachTo(this.previewCanvasModel);
      }, 0);
    }

  private async _getXmlByProcessModelId(processModelId: string): Promise<string> {
    const processModel: DataModels.ProcessModels.ProcessModel = await this._liveExecutionTrackerService.getProcessModelById(processModelId);

    return processModel.xml;
  }

  private _elementClickHandler: (event: IEvent) => Promise<void> = async(event: IEvent) => {
    const clickedElement: IShape = event.element;

    this.selectedFlowNode = event.element;

    const clickedElementIsNotAUserOrManualTask: boolean = clickedElement.type !== 'bpmn:UserTask'
                                                       && clickedElement.type !== 'bpmn:ManualTask';

    if (clickedElementIsNotAUserOrManualTask) {
      return;
    }

    this.taskId = clickedElement.id;
  }

  private async _getXml(): Promise<string> {
    const correlation: DataModels.Correlations.Correlation = await this._liveExecutionTrackerService.getCorrelationById(this.correlationId);

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      this._notificationService.showNotification(NotificationType.ERROR, 'Could not get correlation. Please try to start the process again.');

      return;
    }

    const processModelFromCorrelation: DataModels.Correlations.CorrelationProcessInstance =
      correlation.processInstances.find((processModel: DataModels.Correlations.CorrelationProcessInstance) => {
        const processModelIsSearchedProcessModel: boolean = processModel.processInstanceId === this.processInstanceId;

        return processModelIsSearchedProcessModel;
      });

    const xmlFromProcessModel: string = processModelFromCorrelation.xml;

    return xmlFromProcessModel;
  }

  private async _importXmlIntoDiagramViewer(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const xmlCouldNotBeLoadedMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this._notificationService.showNotification(NotificationType.ERROR, xmlCouldNotBeLoadedMessage);

      return;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this._diagramViewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }

        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async _importXmlIntoDiagramPreviewViewer(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const xmlCouldNotBeLoadedMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this._notificationService.showNotification(NotificationType.ERROR, xmlCouldNotBeLoadedMessage);

      return;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this._diagramPreviewViewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }
        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async _exportXmlFromDiagramViewer(): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      const xmlSaveOptions: IBpmnXmlSaveOptions = {
        format: true,
      };

      this._diagramViewer.saveXML(xmlSaveOptions, async(saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
  }

  private async _handleElementColorization(): Promise<void> {
    // This prevents the LET from Coloring several times at once
    if (this._isColorizing) {
      this._colorizeAgain = true;

      return;
    }

    this._isColorizing = true;

    const previousXml: string = await this._exportXmlFromDiagramViewer();

    const colorizedXml: string | undefined = await (async(): Promise<string | undefined> => {
      try {
        return await this._liveExecutionTrackerService.getColorizedDiagram(this.processInstanceId,
                                                                           this._checkIfProcessEngineSupportsGettingFlowNodeInstances());
      } catch (error) {
        const message: string = `Could not colorize XML: ${error}`;

        this._notificationService.showNotification(NotificationType.ERROR, message);

        return;
      }
    })();

    const colorizingWasSuccessfull: boolean = colorizedXml !== undefined;

    const xmlChanged: boolean = previousXml !== colorizedXml;
    if (xmlChanged && colorizingWasSuccessfull) {
      await this._importXmlIntoDiagramViewer(colorizedXml);
      await this._addOverlays();
    }

    this._isColorizing = false;

    // If the colorization was triggered while colorizing, the colorization needs to be repeated as soon as it is finished
    if (this._colorizeAgain) {
      this._colorizeAgain = false;

      this._handleElementColorization();
    }
  }

  private async _getParentProcessInstanceId(): Promise<string> {

    const correlation: DataModels.Correlations.Correlation = await this._liveExecutionTrackerService.getCorrelationById(this.correlationId);

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processInstanceFromCorrelation: DataModels.Correlations.CorrelationProcessInstance = correlation.processInstances
      .find((correlationProcessInstance: DataModels.Correlations.CorrelationProcessInstance): boolean => {
        const processInstanceFound: boolean = correlationProcessInstance.processInstanceId === this.processInstanceId;

        return processInstanceFound;
      });

    const {parentProcessInstanceId} = processInstanceFromCorrelation;

    return parentProcessInstanceId;
  }

  private _createBackendEventListeners(): Promise<Array<Subscription>> {
    const processEndedCallback: Function = (): void => {
      this._handleElementColorization();

      this._sendProcessStoppedNotification();
    };

    const colorizationCallback: Function = (): void => {
      this._handleElementColorization();
    };

    const processEndedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createProcessEndedEventListener(this.processInstanceId, processEndedCallback);
    const processTerminatedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createProcessTerminatedEventListener(this.processInstanceId, processEndedCallback);

    const userTaskWaitingSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createUserTaskWaitingEventListener(this.processInstanceId, colorizationCallback);
    const userTaskFinishedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createUserTaskFinishedEventListener(this.processInstanceId, colorizationCallback);
    const manualTaskWaitingSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createManualTaskWaitingEventListener(this.processInstanceId, colorizationCallback);
    const manualTaskFinishedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createManualTaskFinishedEventListener(this.processInstanceId, colorizationCallback);
    const emptyActivityWaitingSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createEmptyActivityWaitingEventListener(this.processInstanceId, colorizationCallback);
    const emptyActivityFinishedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createEmptyActivityFinishedEventListener(this.processInstanceId, colorizationCallback);
    const activityReachedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createActivityReachedEventListener(this.processInstanceId, colorizationCallback);
    const activityFinishedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createActivityFinishedEventListener(this.processInstanceId, colorizationCallback);
    const boundaryEventTriggeredSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createBoundaryEventTriggeredEventListener(this.processInstanceId, colorizationCallback);
    const intermediateThrowEventTriggeredSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createIntermediateThrowEventTriggeredEventListener(this.processInstanceId, colorizationCallback);
    const intermediateCatchEventReachedSubscriptionPromise: Promise<Subscription> =
        this._liveExecutionTrackerService.createIntermediateCatchEventReachedEventListener(this.processInstanceId, colorizationCallback);
    const intermediateCatchEventFinishedSubscriptionPromise: Promise<Subscription> =
      this._liveExecutionTrackerService.createIntermediateCatchEventFinishedEventListener(this.processInstanceId, colorizationCallback);

    const subscriptionPromises: Array<Promise<Subscription>> = [
                                                                processEndedSubscriptionPromise,
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

  private _startPolling(): void {
    this._pollingTimer = setTimeout(async() => {
      // Stop polling if not attached
      const notAttached: boolean = !this._attached;
      if (notAttached) {
        return;
      }

      const isProcessInstanceActive: Function = async(): Promise<boolean> => {
        try {
          return await this._liveExecutionTrackerService.isProcessInstanceActive(this.processInstanceId);
        } catch (error) {
          const connectionLost: boolean = error === RequestError.ConnectionLost;
          // Keep polling if connection is lost
          if (connectionLost) {
            this._startPolling();
          } else {
            const notificationMessage: string = 'Could not get active correlations. Please try to start the process again.';

            this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);
          }

          return false;
        }
      };

      await this._handleElementColorization();

      const processInstanceIsActive: boolean = await isProcessInstanceActive();

      const processInstanceIsNotActive: boolean = processInstanceIsActive === false;
      if (processInstanceIsNotActive) {
        this._sendProcessStoppedNotification();

        return;
      }

      this._startPolling();
    }, environment.processengine.liveExecutionTrackerPollingIntervalInMs);
  }

  private _stopPolling(): void {
    clearTimeout(this._pollingTimer);
  }

  private _sendProcessStoppedNotification(): void {
    this._processStopped = true;

    this._notificationService.showNotification(NotificationType.INFO, 'Process stopped.');
  }

  private _resizeTokenViewer(mouseEvent: MouseEvent): void {
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
