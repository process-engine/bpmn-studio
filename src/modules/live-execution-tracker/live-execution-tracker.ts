import {computedFrom, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import * as bundle from '@process-engine/bpmn-js-custom-bundle';

import {DataModels, IManagementApi} from '@process-engine/management_api_contracts';

import {ActiveToken} from '@process-engine/kpi_api_contracts';
import {CorrelationProcessModel} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {
  defaultBpmnColors,
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  ICanvas,
  IColorPickerColor,
  IElementRegistry,
  IEvent,
  IEventFunction,
  IModdleElement,
  IModeling,
  IOverlayManager,
  IShape,
  ISolutionEntry,
  ISolutionService,
  NotificationType,
} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../notification/notification.service';
import {TaskDynamicUi} from '../task-dynamic-ui/task-dynamic-ui';

type RouteParameters = {
  diagramName: string,
  solutionUri: string,
  correlationId: string,
  processInstanceId: string,
  taskId: string,
};

enum RequestError {
  ConnectionLost = 'connectionLost',
  OtherError = 'otherError',
}

@inject(Router, 'NotificationService', 'ManagementApiClientService', 'SolutionService')
export class LiveExecutionTracker {
  public canvasModel: HTMLElement;
  public showDynamicUiModal: boolean = false;
  public dynamicUi: TaskDynamicUi;
  public liveExecutionTracker: LiveExecutionTracker = this;
  public modalStyleString: string = 'position: relative; top: 20%; bottom: 20%; width: 400px; height: 60%;';

  @observable public tokenViewerWidth: number = 250;
  public tokenViewer: HTMLElement;
  public tokenViewerResizeDiv: HTMLElement;
  public showTokenViewer: boolean = false;

  public activeDiagram: IDiagram;
  public selectedFlowNode: IShape;
  public correlation: DataModels.Correlations.Correlation;

  public correlationId: string;
  public processModelId: string;
  public processInstanceId: string;
  public taskId: string;

  private _diagramModeler: IBpmnModeler;
  private _diagramViewer: IBpmnModeler;
  private _modeling: IModeling;
  private _elementRegistry: IElementRegistry;
  private _viewerCanvas: ICanvas;
  private _overlays: IOverlayManager;

  private _router: Router;
  private _notificationService: NotificationService;
  private _managementApiClient: IManagementApi;
  private _solutionService: ISolutionService;

  private activeSolutionEntry: ISolutionEntry;

  private _pollingTimer: NodeJS.Timer;
  private _attached: boolean;
  private _previousElementIdsWithActiveToken: Array<string> = [];
  private _activeTokens: Array<ActiveToken>;
  private _parentProcessInstanceId: string;
  private _parentProcessModelId: string;
  private _maxRetries: number = 5;
  private _activeCallActivities: Array<IShape> = [];

  private _elementsWithEventListeners: Array<string> = [];

  constructor(router: Router,
              notificationService: NotificationService,
              managementApiClient: IManagementApi,
              solutionService: ISolutionService) {

    this._router = router;
    this._notificationService = notificationService;
    this._managementApiClient = managementApiClient;
    this._solutionService = solutionService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    this.correlationId = routeParameters.correlationId;
    this.processModelId = routeParameters.diagramName;
    this.activeSolutionEntry = await this._solutionService.getSolutionEntryForUri(routeParameters.solutionUri);

    this.processInstanceId = routeParameters.processInstanceId;

    this._parentProcessInstanceId = await this._getParentProcessInstanceId();
    const hasTaskId: boolean = routeParameters.taskId !== undefined
      && routeParameters.taskId !== null && routeParameters.taskId !== '';

    if (hasTaskId) {
      this.taskId = routeParameters.taskId;
      this.showDynamicUiModal = true;
    }

    this._parentProcessModelId = await this._getParentProcessModelId();

    this.correlation = await this._managementApiClient.getCorrelationById(this.activeSolutionEntry.identity, this.correlationId);
    this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(this.processModelId);
  }

  public async attached(): Promise<void> {
    this._attached = true;
    this._diagramModeler = new bundle.modeler();
    this._diagramViewer = new bundle.viewer({
      additionalModules:
        [
          bundle.ZoomScrollModule,
          bundle.MoveCanvasModule,
          bundle.MiniMap,
        ],
    });

    this._modeling = this._diagramModeler.get('modeling');
    this._elementRegistry = this._diagramModeler.get('elementRegistry');
    this._viewerCanvas = this._diagramViewer.get('canvas');
    this._overlays = this._diagramViewer.get('overlays');

    this._diagramViewer.attachTo(this.canvasModel);

    const xml: string = await this._getXml();

    const couldNotGetXml: boolean = xml === undefined;
    if (couldNotGetXml) {
      return;
    }

    const colorizedXml: string = await (async(): Promise<string> => {
      try {
        return await this._colorizeXml(xml);
      } catch {
        return undefined;
      }
    })();

    const colorizingFailed: boolean = colorizedXml === undefined;
    if (colorizingFailed) {
      const notificationMessage: string = 'Could not get tokens. '
        + 'Please try reopening the Live Execution Tracker or restarting the process.';

      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    await this._importXmlIntoDiagramViewer(colorizedXml);

    this._diagramViewer.on('element.click', this._elementClickHandler);

    this._viewerCanvas.zoom('fit-viewport');

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

    this._startPolling();
  }

  public detached(): void {
    this._attached = false;

    this._diagramViewer.detach();
    this._diagramViewer.destroy();

    this._stopPolling();
  }

  public determineActivationStrategy(): string {
    return 'replace';
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

  public toggleShowTokenViewer(): void {
    this.showTokenViewer = !this.showTokenViewer;
  }

  private async _getParentProcessModelId(): Promise<string> {
    const parentProcessInstanceIdNotFound: boolean = this._parentProcessInstanceId === undefined;
    if (parentProcessInstanceIdNotFound) {
      return undefined;
    }

    const parentProcessModel: DataModels.Correlations.CorrelationProcessModel =
      await this._getProcessModelByProcessInstanceId(this._parentProcessInstanceId);

    const parentProcessModelNotFound: boolean = parentProcessModel === undefined;
    if (parentProcessModelNotFound) {
      return undefined;
    }

    return parentProcessModel.processModelId;
  }

  private async _colorizeXml(xml: string): Promise<string> {
    // Import the xml to the modeler to add colors to it
    await this._importXmlIntoDiagramModeler(xml);

    // Get all elements that can have a token
    const allElements: Array<IShape> = this._elementRegistry.filter((element: IShape): boolean => {
      const elementCanHaveAToken: boolean = element.type !== 'bpmn:SequenceFlow'
        && element.type !== 'bpmn:Collaboration'
        && element.type !== 'bpmn:Participant'
        && element.type !== 'bpmn:Lane'
        && element.type !== 'label';

      return elementCanHaveAToken;
    });

    // Get all elements that already have an active token.
    const elementsWithActiveToken: Array<IShape> = await this._getElementsWithActiveToken(allElements);

    // If the backend returned an error the diagram should not be rendered.
    const couldNotGetActiveTokens: boolean = elementsWithActiveToken === null;
    if (couldNotGetActiveTokens) {
      throw new Error('Could not get ActiveTokens.');
    }

    // Get all elements that already have a token.
    const elementsWithTokenHistory: Array<IShape> = await this._getElementsWithTokenHistory(allElements);

    // If the backend returned an error the diagram should not be rendered.
    const couldNotGetTokenHistory: boolean = elementsWithTokenHistory === null;
    if (couldNotGetTokenHistory) {
      throw new Error('Could not get TokenHistories.');
    }

    /*
     * Remove all colors if the diagram has already colored elements.
     * For example, if the user has some elements colored orange and is running
     * the diagram, one would think in LiveExecutionTracker that the element is
     * active although it is not active.
    */
    this._clearColors();

    // Colorize the found elements and add overlay to those that can be started.
    this._colorizeElements(elementsWithTokenHistory, defaultBpmnColors.green);
    this._colorizeElements(elementsWithActiveToken, defaultBpmnColors.orange);
    this._addOverlaysToUserAndManualTasks(elementsWithActiveToken);
    this._addOverlaysToCallActivities(elementsWithActiveToken);

    // Get the elementIds of the elements with an active token and sort them alphabetically
    this._previousElementIdsWithActiveToken = elementsWithActiveToken.map((element: IShape) => element.id).sort();

    // Export the colored xml from the modeler
    const colorizedXml: string = await this._exportXmlFromDiagramModeler();
    return colorizedXml;
  }

  private _addOverlaysToUserAndManualTasks(elements: Array<IShape>): void {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return;
    }

    const activeManualAndUserTasks: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsAUserOrManualTask: boolean = element.type === 'bpmn:UserTask'
        || element.type === 'bpmn:ManualTask';

      return elementIsAUserOrManualTask;
    });

    const activeManualAndUserTaskIds: Array<string> = activeManualAndUserTasks.map((element: IShape) => element.id).sort();

    const elementsWithActiveTokenDidNotChange: boolean = activeManualAndUserTaskIds.toString() === this._previousElementIdsWithActiveToken.toString();
    const allActiveElementsHaveAnOverlay: boolean = activeManualAndUserTaskIds.length === Object.keys(this._overlays._overlays).length;

    if (elementsWithActiveTokenDidNotChange && allActiveElementsHaveAnOverlay) {
      return;
    }

    for (const elementId of this._elementsWithEventListeners) {
      document.getElementById(elementId).removeEventListener('click', this._handleTaskClick);
    }

    for (const callActivity of this._activeCallActivities) {
      document.getElementById(callActivity.id).removeEventListener('click', this._handleCallActivityClick);
    }

    this._elementsWithEventListeners = [];
    this._overlays.clear();

    for (const element of activeManualAndUserTasks) {
      this._overlays.add(element, {
        position: {
          left: -1,
          top: -1,
        },
        html: `<div class="play-task-button-container" id="${element.id}"><i class="fas fa-play play-task-button"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleTaskClick);

      this._elementsWithEventListeners.push(element.id);
    }
  }

  private _addOverlaysToCallActivities(elements: Array<IShape>): void {
    const liveExecutionTrackerIsNotAttached: boolean = !this._attached;
    if (liveExecutionTrackerIsNotAttached) {
      return;
    }

    const activeCallActivities: Array<IShape> = elements.filter((element: IShape) => {
      const elementIsCallActivity: boolean = element.type === 'bpmn:CallActivity';

      return elementIsCallActivity;
    });

    const activeCallActivityIds: Array<string> = activeCallActivities.map((element: IShape) => element.id).sort();

    const elementsWithActiveTokenDidNotChange: boolean = activeCallActivityIds.toString() === this._previousElementIdsWithActiveToken.toString();
    const allActiveElementsHaveAnOverlay: boolean = activeCallActivityIds.length === Object.keys(this._overlays._overlays).length;

    if (elementsWithActiveTokenDidNotChange && allActiveElementsHaveAnOverlay) {
      return;
    }

    this._activeCallActivities = activeCallActivities;

    for (const element of activeCallActivities) {
      this._overlays.add(element, {
        position: {
          left: -1,
          top: -1,
        },
        html: `<div class="play-task-button-container" id="${element.id}"><i class="fas fa-external-link-square-alt play-task-button"></i></div>`,
      });

      document.getElementById(element.id).addEventListener('click', this._handleCallActivityClick);

      this._elementsWithEventListeners.push(element.id);
    }
  }

  private _handleTaskClick: (event: MouseEvent) => void =
    (event: MouseEvent): void => {
      const elementId: string = (event.target as HTMLDivElement).id;
      this.taskId = elementId;

      this.showDynamicUiModal = true;
    }

  private _handleCallActivityClick: (event: MouseEvent) => Promise<void> =
    async(event: MouseEvent): Promise<void> => {
      const elementId: string = (event.target as HTMLDivElement).id;
      const element: IShape = this._elementRegistry.get(elementId);
      const callActivityTargetProcess: string = element.businessObject.calledElement;

      const callAcitivityHasNoTargetProcess: boolean = callActivityTargetProcess === undefined;
      if (callAcitivityHasNoTargetProcess) {
        const notificationMessage: string = 'The CallActivity has no target configured. Please configure a target in the designer.';

        this._notificationService.showNotification(NotificationType.INFO, notificationMessage);
      }

      const targetProcessInstanceId: string = await this._getProcessInstanceIdOfCallActivityTarget(callActivityTargetProcess);

      const errorGettingTargetProcessInstanceId: boolean = targetProcessInstanceId === undefined;
      if (errorGettingTargetProcessInstanceId) {
        return;
      }

      this._router.navigateToRoute('live-execution-tracker', {
        diagramName: callActivityTargetProcess,
        solutionUri: this.activeSolutionEntry.uri,
        correlationId: this.correlationId,
        processInstanceId: targetProcessInstanceId,
      });
    }

  private async _getProcessInstanceIdOfCallActivityTarget(callActivityTargetId: string): Promise<string> {
    // This is necessary because the managementApi sometimes throws an error when the correlation is not yet existing.
    const getCorrelation: () => Promise<DataModels.Correlations.Correlation> = async(): Promise<DataModels.Correlations.Correlation> => {
      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getCorrelationById(this.activeSolutionEntry.identity, this.correlationId);
        } catch {
          continue;
        }
      }

      const notificationMessage: string = 'Could not get correlation. Please try to click on the call activity again.';

      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return undefined;
    };

    const correlation: DataModels.Correlations.Correlation = await getCorrelation();

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const callActivityTarget: CorrelationProcessModel = correlation.processModels
      .find((correlationProcessModel: CorrelationProcessModel): boolean => {
        const targetProcessModelFound: boolean = correlationProcessModel.parentProcessInstanceId === this.processInstanceId
          && correlationProcessModel.processModelId === callActivityTargetId;

        return targetProcessModelFound;
      });

    return callActivityTarget.processInstanceId;
  }

  private _elementClickHandler: (event: IEvent) => Promise<void> = async(event: IEvent) => {
    const clickedElement: IShape = event.element;

    this.selectedFlowNode = event.element;

    const clickedElementIsNotAUserOrManualTask: boolean = clickedElement.type !== 'bpmn:UserTask'
      && clickedElement.type !== 'bpmn:ManualTask';

    if (clickedElementIsNotAUserOrManualTask) {
      return;
    }

    const elementHasNoActiveToken: boolean = !this._hasElementActiveToken(clickedElement.id);
    if (elementHasNoActiveToken) {
      return;
    }

    this.showDynamicUiModal = true;
    this.taskId = clickedElement.id;
  }

  private async _getElementsWithActiveToken(elements: Array<IShape>): Promise<Array<IShape> | null> {

    const getActiveTokens: Function = async(): Promise<Array<ActiveToken> | null> => {
      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getActiveTokensForProcessInstance(this.activeSolutionEntry.identity, this.processInstanceId);
        } catch {
          continue;
        }
      }

      return null;
    };

    const activeTokens: Array<ActiveToken> | null = await getActiveTokens();

    const couldNotGetActiveTokens: boolean = activeTokens === null;
    if (couldNotGetActiveTokens) {
      return null;
    }

    this._activeTokens = activeTokens;
    const elementsWithActiveToken: Array<IShape> = this._activeTokens.map((activeToken: ActiveToken): IShape => {
      const elementWithActiveToken: IShape = elements.find((element: IShape) => {
        return element.id === activeToken.flowNodeId;
      });

      return elementWithActiveToken;
    });

    return elementsWithActiveToken;
  }

  private async _getElementsWithTokenHistory(elements: Array<IShape>): Promise<Array<IShape> | null> {

    const getTokenHistoryGroup: Function = async(): Promise<DataModels.TokenHistory.TokenHistoryGroup | null> => {
      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getTokensForProcessInstance(this.activeSolutionEntry.identity, this.processInstanceId);
        } catch {
          continue;
        }
      }

      return null;
    };

    const tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup = await getTokenHistoryGroup();

    const couldNotGetTokenHistory: boolean = tokenHistoryGroups === null;
    if (couldNotGetTokenHistory) {
      return null;
    }

    const elementsWithTokenHistory: Array<IShape> = [];

    for (const flowNodeId in tokenHistoryGroups) {
      const elementFromTokenHistory: IShape = elements.find((element: IShape) => {
        return element.id === flowNodeId;
      });

      const elementWithIncomingElements: Array<IShape> = this._getElementWithIncomingElements(elementFromTokenHistory, tokenHistoryGroups);

      elementsWithTokenHistory.push(...elementWithIncomingElements);
    }

    return elementsWithTokenHistory;
  }

  private _getElementWithIncomingElements(element: IShape,
                                          tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup): Array<IShape> {

    const elementWithIncomingElements: Array<IShape> = [];

    const elementHasNoTokenHistory: boolean = !this._hasElementTokenHistory(element.id, tokenHistoryGroups);

    if (elementHasNoTokenHistory) {
      return [];
    }

    elementWithIncomingElements.push(element);

    const incomingElementsAsIModdleElement: Array<IModdleElement> = element.businessObject.incoming;

    const elementHasIncomingElements: boolean = incomingElementsAsIModdleElement === undefined;
    if (elementHasIncomingElements) {
      return elementWithIncomingElements;
    }

    for (const incomingElement of incomingElementsAsIModdleElement) {
      const incomingElementAsShape: IShape = this._elementRegistry.get(incomingElement.id);
      const sourceOfIncomingElement: IShape = incomingElementAsShape.source;

      const incomignElementHasNoSource: boolean = sourceOfIncomingElement === undefined;
      if (incomignElementHasNoSource) {
        continue;
      }

      const previousElementIsTask: boolean = sourceOfIncomingElement.type.includes('Task');

      if (previousElementIsTask) {
        const elementHasActiveToken: boolean = this._hasElementActiveToken(sourceOfIncomingElement.id);
        const sourceOfIncomingElementHasNoTokenHistory: boolean = !this._hasElementTokenHistory(sourceOfIncomingElement.id, tokenHistoryGroups);

        if (elementHasActiveToken || sourceOfIncomingElementHasNoTokenHistory) {
          continue;
        }

        elementWithIncomingElements.push(incomingElementAsShape);

      } else {
        elementWithIncomingElements.push(incomingElementAsShape);

        const sourceHasNoTokenHistory: boolean = !this._hasElementTokenHistory(sourceOfIncomingElement.id, tokenHistoryGroups);
        if (sourceHasNoTokenHistory) {
          elementWithIncomingElements.push(sourceOfIncomingElement);
        }

        continue;
      }
    }

    return elementWithIncomingElements;
  }

  private _colorizeElements(elements: Array<IShape>, color: IColorPickerColor): void {
    const noElementsToColorize: boolean = elements.length === 0;
    if (noElementsToColorize) {
      return;
    }

    this._modeling.setColor(elements, {
      stroke: color.border,
      fill: color.fill,
    });
  }

  private _hasElementTokenHistory(elementId: string, tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup): boolean {

    const tokenHistoryFromFlowNodeInstanceFound: boolean = tokenHistoryGroups[elementId] !== undefined;

    return tokenHistoryFromFlowNodeInstanceFound;
  }

  private _hasElementActiveToken(elementId: string): boolean {
    const activeTokenForFlowNodeInstance: ActiveToken = this._activeTokens.find((activeToken: ActiveToken) => {
      const activeTokenIsFromFlowNodeInstance: boolean = activeToken.flowNodeId === elementId;

      return activeTokenIsFromFlowNodeInstance;
    });

    return activeTokenForFlowNodeInstance !== undefined;
  }

  private async _getXml(): Promise<string> {

    // This is necessary because the managementApi sometimes throws an error when the correlation is not yet existing.
    const getCorrelation: () => Promise<DataModels.Correlations.Correlation> = async(): Promise<DataModels.Correlations.Correlation> => {
      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getCorrelationById(this.activeSolutionEntry.identity, this.correlationId);
        } catch {
          continue;
        }
      }

      this._notificationService.showNotification(NotificationType.ERROR, 'Could not get correlation. Please try to start the process again.');

      return undefined;
    };

    const correlation: DataModels.Correlations.Correlation = await getCorrelation();

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return;
    }

    const processModelFromCorrelation: DataModels.Correlations.CorrelationProcessModel =
      correlation.processModels.find((processModel: DataModels.Correlations.CorrelationProcessModel) => {
        const processModelIsSearchedProcessModel: boolean = processModel.processModelId === this.processModelId;

        return processModelIsSearchedProcessModel;
      });

    const xmlFromProcessModel: string = processModelFromCorrelation.xml;

    return xmlFromProcessModel;
  }

  private _clearColors(): void {
    const elementsWithColor: Array<IShape> = this._elementRegistry.filter((element: IShape): boolean => {
      const elementHasFillColor: boolean = element.businessObject.di.fill !== undefined;
      const elementHasBorderColor: boolean = element.businessObject.di.stroke !== undefined;

      const elementHasColor: boolean = elementHasFillColor || elementHasBorderColor;

      return elementHasColor;
    });

    const noElementsWithColor: boolean = elementsWithColor.length === 0;
    if (noElementsWithColor) {
      return;
    }

    this._modeling.setColor(elementsWithColor, {
      stroke: defaultBpmnColors.none.border,
      fill: defaultBpmnColors.none.fill,
    });
  }

  private async _importXmlIntoDiagramViewer(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const notificationMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

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

  private async _importXmlIntoDiagramModeler(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const notificationMessage: string = 'The xml could not be loaded. Please try to start the process again.';

      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this._diagramModeler.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }
        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async _exportXmlFromDiagramModeler(): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      const xmlSaveOptions: IBpmnXmlSaveOptions = {
        format: true,
      };

      this._diagramModeler.saveXML(xmlSaveOptions, async(saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
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

  private async _startPolling(): Promise<void> {
    const handleElementColorization: Function = async(): Promise<void> => {
      const previousXml: string = await this._exportXmlFromDiagramViewer();
      const xml: string = await this._getXml();

      const couldNotGetXml: boolean = xml === undefined;
      if (couldNotGetXml) {
        const notificationMessage: string = 'XML could not be found. If the error persists, '
          + 'try reopening the Live Execution Tracker or restarting the process.';

        this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

        return;
      }

      const colorizedXml: string = await (async(): Promise<string> => {
        try {
          return await this._colorizeXml(xml);
        } catch {
          return undefined;
        }
      })();

      const colorizingFailed: boolean = colorizedXml === undefined;
      if (colorizingFailed) {
        const notificationMessage: string = 'Could not get tokens. If the error persists, '
          + 'try reopening the Live Execution Tracker or restarting the process.';

        this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

        return;
      }

      const xmlChanged: boolean = previousXml !== colorizedXml;
      if (xmlChanged) {
        await this._importXmlIntoDiagramViewer(colorizedXml);
      }
    };

    this._pollingTimer = setTimeout(async() => {
      // Stop polling if not attached
      const notAttached: boolean = !this._attached;
      if (notAttached) {
        return;
      }

      const correlationIsStillActive: boolean | RequestError = await this._isCorrelationStillActive();

      const connectionLost: boolean = correlationIsStillActive === RequestError.ConnectionLost;
      const errorCheckingCorrelationState: boolean = correlationIsStillActive === RequestError.OtherError;

      // Keep polling if connectionLost
      if (connectionLost) {
        this._startPolling();

        return;
      }

      // Stop polling if checking the correlation state was not successfull
      if (errorCheckingCorrelationState) {
        const notificationMessage: string = 'Could not get active correlations. Please try to start the process again.';

        this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

        return;
      }

      await handleElementColorization();

      if (correlationIsStillActive && this._attached) {
        this._startPolling();
      }
    }, environment.processengine.liveExecutionTrackerPollingIntervalInMs);
  }

  private _stopPolling(): void {
    clearTimeout(this._pollingTimer);
  }

  private async _isCorrelationStillActive(): Promise<boolean | RequestError> {

    const getActiveCorrelations: Function = async(): Promise<Array<DataModels.Correlations.Correlation> | RequestError> => {
      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getActiveCorrelations(this.activeSolutionEntry.identity);
        } catch (error) {
          const errorIsConnectionLost: boolean = error.message === 'Failed to fetch';

          if (errorIsConnectionLost) {
            return RequestError.ConnectionLost;
          }
        }
      }

      return RequestError.OtherError;
    };

    const allActiveCorrelationsOrRequestError: Array<DataModels.Correlations.Correlation> | RequestError = await getActiveCorrelations();

    const couldNotGetCorrelation: boolean = allActiveCorrelationsOrRequestError === RequestError.ConnectionLost
      || allActiveCorrelationsOrRequestError === RequestError.OtherError;
    if (couldNotGetCorrelation) {
      const requestError: RequestError = (allActiveCorrelationsOrRequestError as RequestError);

      return requestError;
    }

    const allActiveCorrelations: Array<DataModels.Correlations.Correlation> =
      (allActiveCorrelationsOrRequestError as Array<DataModels.Correlations.Correlation>);

    const correlationIsNotActive: boolean = !allActiveCorrelations.some((activeCorrelation: DataModels.Correlations.Correlation) => {
      return activeCorrelation.id === this.correlationId;
    });

    if (correlationIsNotActive) {
      this._correlationEnded();
    }

    return !correlationIsNotActive;
  }

  private _correlationEnded(): void {
    this._notificationService.showNotification(NotificationType.INFO, 'Process stopped.');
  }

  private async _getParentProcessInstanceId(): Promise<string> {
    // This is necessary because the managementApi sometimes throws an error when the correlation is not yet existing.
    const getCorrelation: () => Promise<DataModels.Correlations.Correlation> = async(): Promise<DataModels.Correlations.Correlation> => {

      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getCorrelationById(this.activeSolutionEntry.identity, this.correlationId);
        } catch {
          continue;
        }
      }

      this._notificationService.showNotification(NotificationType.ERROR, 'Could not get correlation. Please try to start the process again.');

      return undefined;
    };

    const correlation: DataModels.Correlations.Correlation = await getCorrelation();

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processModelFromCorrelation: DataModels.Correlations.CorrelationProcessModel = correlation.processModels
      .find((correlationProcessModel: DataModels.Correlations.CorrelationProcessModel): boolean => {
        const processModelFound: boolean = correlationProcessModel.processInstanceId === this.processInstanceId;

        return processModelFound;
      });

    const {parentProcessInstanceId} = processModelFromCorrelation;

    return parentProcessInstanceId;
  }

  private async _getProcessModelByProcessInstanceId(processInstanceId: string): Promise<DataModels.Correlations.CorrelationProcessModel> {

    // This is necessary because the managementApi sometimes throws an error when the correlation is not yet existing.
    const getCorrelation: () => Promise<DataModels.Correlations.Correlation> = async(): Promise<DataModels.Correlations.Correlation> => {

      for (let retries: number = 0; retries < this._maxRetries; retries++) {
        try {
          return await this._managementApiClient.getCorrelationById(this.activeSolutionEntry.identity, this.correlationId);
        } catch {
          continue;
        }
      }

      this._notificationService.showNotification(NotificationType.ERROR, 'Could not get correlation. Please try to start the process again.');

      return undefined;
    };

    const correlation: DataModels.Correlations.Correlation = await getCorrelation();

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processModel: DataModels.Correlations.CorrelationProcessModel =
      correlation.processModels.find((correlationProcessModel: DataModels.Correlations.CorrelationProcessModel): boolean => {
        const processModelFound: boolean = correlationProcessModel.processInstanceId === processInstanceId;

        return processModelFound;
      });

    return processModel;
  }

  private _resizeTokenViewer(mouseEvent: MouseEvent): void {
    const mouseXPosition: number = mouseEvent.clientX;

    const inspectCorrelation: HTMLElement = this.tokenViewer.parentElement;
    const minSpaceForDiagramViewer: number = 320;

    const windowWidth: number = window.innerWidth;
    const rightToolbarWidth: number = 36;

    const minTokenViewerWidth: number = 250;
    const maxTokenViewerWidth: number = inspectCorrelation.clientWidth - minSpaceForDiagramViewer;

    const newTokenViewerWidth: number = windowWidth - mouseXPosition - rightToolbarWidth;

    /*
     * This sets the new width of the token viewer to the minimum or maximum width,
     * if the new width is smaller than the minimum or bigger than the maximum width.
     */
    this.tokenViewerWidth = Math.min(maxTokenViewerWidth, Math.max(newTokenViewerWidth, minTokenViewerWidth));
  }
}
