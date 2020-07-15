/* eslint-disable 6river/new-cap */
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  IColorPickerColor,
  IElementRegistry,
  IModeling,
  ISolutionEntry,
  defaultBpmnColors,
} from '../../../contracts/index';
import {ILiveExecutionTrackerRepository, ILiveExecutionTrackerService} from '../contracts/index';
import {createLiveExecutionTrackerRepository} from '../repositories/live-execution-tracker-repository-factory';
import environment from '../../../environment';
import {getIllegalIdErrors, getValidXml} from '../../../services/xml-id-validation-module/xml-id-validation-module';

export class LiveExecutionTrackerService implements ILiveExecutionTrackerService {
  private liveExecutionTrackerRepository: ILiveExecutionTrackerRepository;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    eventAggregator.subscribe(environment.events.configPanel.solutionEntryChanged, (solutionEntry: ISolutionEntry) => {
      this.liveExecutionTrackerRepository = createLiveExecutionTrackerRepository(
        managementApiClient,
        solutionEntry.processEngineVersion,
      );
    });
  }

  public isProcessInstanceActive(identity: IIdentity, processInstanceId: string): Promise<boolean> {
    return this.liveExecutionTrackerRepository.isProcessInstanceActive(identity, processInstanceId);
  }

  public getCorrelationById(identity: IIdentity, correlationId: string): Promise<DataModels.Correlations.Correlation> {
    return this.liveExecutionTrackerRepository.getCorrelationById(identity, correlationId);
  }

  public getTokenHistoryGroupForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | null> {
    return this.liveExecutionTrackerRepository.getTokenHistoryGroupForProcessInstance(identity, processInstanceId);
  }

  public getActiveTokensForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.Kpi.ActiveTokenList> {
    return this.liveExecutionTrackerRepository.getActiveTokensForProcessInstance(identity, processInstanceId);
  }

  public getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList | null> {
    return this.liveExecutionTrackerRepository.getEmptyActivitiesForProcessInstance(identity, processInstanceId);
  }

  public getProcessModelById(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ProcessModels.ProcessModel> {
    return this.liveExecutionTrackerRepository.getProcessModelById(identity, processModelId);
  }

  public finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivity: DataModels.EmptyActivities.EmptyActivity,
  ): Promise<void> {
    return this.liveExecutionTrackerRepository.finishEmptyActivity(
      identity,
      processInstanceId,
      correlationId,
      emptyActivity,
    );
  }

  public createProcessEndedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createProcessEndedEventListener(identity, processInstanceId, callback);
  }

  public createProcessErrorEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createProcessErrorEventListener(identity, processInstanceId, callback);
  }

  public createProcessTerminatedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createProcessTerminatedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createUserTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createUserTaskWaitingEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createUserTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createUserTaskFinishedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createManualTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createManualTaskWaitingEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createManualTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createManualTaskFinishedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createEmptyActivityWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createEmptyActivityWaitingEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createEmptyActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createEmptyActivityFinishedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createActivityReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createActivityReachedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createActivityFinishedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createBoundaryEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createBoundaryEventTriggeredEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createIntermediateThrowEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createIntermediateThrowEventTriggeredEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createIntermediateCatchEventReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createIntermediateCatchEventReachedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public createIntermediateCatchEventFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.liveExecutionTrackerRepository.createIntermediateCatchEventFinishedEventListener(
      identity,
      processInstanceId,
      callback,
    );
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    return this.liveExecutionTrackerRepository.removeSubscription(identity, subscription);
  }

  public async getElementsWithActiveToken(
    identity: IIdentity,
    processInstanceId: string,
    elementRegistry: IElementRegistry,
  ): Promise<Array<IShape> | null> {
    const elements: Array<IShape> = this.getAllElementsThatCanHaveAToken(elementRegistry);

    const activeTokenList: DataModels.Kpi.ActiveTokenList | null = await this.getActiveTokensForProcessInstance(
      identity,
      processInstanceId,
    );
    const couldNotGetActiveTokens: boolean = activeTokenList === null;
    if (couldNotGetActiveTokens) {
      return null;
    }

    const elementsWithActiveToken: Array<IShape> = activeTokenList.activeTokens.map(
      (activeToken: DataModels.Kpi.ActiveToken): IShape => {
        const elementWithActiveToken: IShape = elements.find((element: IShape) => {
          return element.id === activeToken.flowNodeId;
        });

        return elementWithActiveToken;
      },
    );

    return elementsWithActiveToken;
  }

  public async getElementsWithTokenHistory(
    identity: IIdentity,
    processInstanceId: string,
    elementRegistry: IElementRegistry,
  ): Promise<Array<IShape>> {
    const elements: Array<IShape> = this.getAllElementsThatCanHaveAToken(elementRegistry);

    const tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup = await this.getTokenHistoryGroupForProcessInstance(
      identity,
      processInstanceId,
    );

    const couldNotGetTokenHistory: boolean = tokenHistoryGroups === null;
    if (couldNotGetTokenHistory) {
      return undefined;
    }

    const elementsWithTokenHistory: Array<IShape> = [];

    const flowNodeIds: Array<string> = Object.keys(tokenHistoryGroups);

    for (const flowNodeId of flowNodeIds) {
      const elementFromTokenHistory: IShape = elements.find((element: IShape) => {
        return element.id === flowNodeId;
      });

      const elementFinished: boolean =
        tokenHistoryGroups[flowNodeId].tokenHistoryEntries.find(
          (tokenHistoryEntry: DataModels.TokenHistory.TokenHistoryEntry) => {
            return tokenHistoryEntry.tokenEventType === DataModels.TokenHistory.TokenEventType.onExit;
          },
        ) !== undefined;

      if (elementFinished) {
        elementsWithTokenHistory.push(elementFromTokenHistory);

        const outgoingElements: Array<IShape> = this.getOutgoingElementsOfElement(
          elementFromTokenHistory,
          tokenHistoryGroups,
          elementRegistry,
        );

        elementsWithTokenHistory.push(...outgoingElements);
      }
    }

    return elementsWithTokenHistory;
  }

  public elementHasTokenHistory(
    elementId: string,
    tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup,
  ): boolean {
    const tokenHistoryFromFlowNodeInstanceFound: boolean = tokenHistoryGroups[elementId] !== undefined;

    return tokenHistoryFromFlowNodeInstanceFound;
  }

  public elementHasActiveToken(elementId: string, activeTokens: Array<DataModels.Kpi.ActiveToken>): boolean {
    const activeTokenForFlowNodeInstance: DataModels.Kpi.ActiveToken = activeTokens.find(
      (activeToken: DataModels.Kpi.ActiveToken) => {
        const activeTokenIsFromFlowNodeInstance: boolean = activeToken.flowNodeId === elementId;

        return activeTokenIsFromFlowNodeInstance;
      },
    );

    return activeTokenForFlowNodeInstance !== undefined;
  }

  public async getActiveCallActivities(
    identity: IIdentity,
    processInstanceId: string,
    elementRegistry: IElementRegistry,
  ): Promise<Array<IShape>> {
    const activeTokenList: DataModels.Kpi.ActiveTokenList = await this.liveExecutionTrackerRepository.getActiveTokensForProcessInstance(
      identity,
      processInstanceId,
    );

    const callActivities: Array<IShape> = this.getCallActivities(elementRegistry);

    const inactiveCallActivities: Array<IShape> = callActivities.filter((callActivity: IShape) => {
      return this.elementHasActiveToken(callActivity.id, activeTokenList.activeTokens);
    });

    return inactiveCallActivities;
  }

  public async getInactiveCallActivities(
    identity: IIdentity,
    processInstanceId: string,
    elementRegistry: IElementRegistry,
  ): Promise<Array<IShape>> {
    const activeTokenList: DataModels.Kpi.ActiveTokenList = await this.liveExecutionTrackerRepository.getActiveTokensForProcessInstance(
      identity,
      processInstanceId,
    );

    const callActivities: Array<IShape> = this.getCallActivities(elementRegistry);

    const inactiveCallActivities: Array<IShape> = callActivities.filter((callActivity: IShape) => {
      return !this.elementHasActiveToken(callActivity.id, activeTokenList.activeTokens);
    });

    return inactiveCallActivities;
  }

  public async getProcessModelByProcessInstanceId(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
  ): Promise<DataModels.Correlations.ProcessInstance> {
    const correlation: DataModels.Correlations.Correlation = await this.getCorrelationById(identity, correlationId);

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processModel: DataModels.Correlations.ProcessInstance = correlation.processInstances.find(
      (processInstance: DataModels.Correlations.ProcessInstance): boolean => {
        const processModelFound: boolean = processInstance.processInstanceId === processInstanceId;

        return processModelFound;
      },
    );

    return processModel;
  }

  public async getProcessInstanceIdOfCallActivityTarget(
    identity: IIdentity,
    correlationId: string,
    processInstanceIdOfOrigin: string,
    callActivityTargetId: string,
  ): Promise<string> {
    const correlation: DataModels.Correlations.Correlation = await this.getCorrelationById(identity, correlationId);

    const errorGettingCorrelation: boolean = correlation === undefined;
    if (errorGettingCorrelation) {
      return undefined;
    }

    const processInstance: DataModels.Correlations.ProcessInstance = correlation.processInstances.find(
      (currentProcessInstance: DataModels.Correlations.ProcessInstance): boolean => {
        const targetProcessModelFound: boolean =
          currentProcessInstance.parentProcessInstanceId === processInstanceIdOfOrigin &&
          currentProcessInstance.processModelId === callActivityTargetId &&
          currentProcessInstance.state === DataModels.Correlations.CorrelationState.running;

        return targetProcessModelFound;
      },
    );

    const processInstanceFound: boolean = processInstance !== undefined;

    return processInstanceFound ? processInstance.processInstanceId : undefined;
  }

  public async clearDiagramColors(xml: string): Promise<string> {
    const diagramModeler: IBpmnModeler = new bundle.modeler();

    const modeling: IModeling = diagramModeler.get('modeling');
    const elementRegistry: IElementRegistry = diagramModeler.get('elementRegistry');

    await diagramModeler.importXML(xml);

    const elementsWithColor: Array<IShape> = elementRegistry.filter((element: IShape): boolean => {
      const elementHasFillColor: boolean = element.businessObject.di.fill !== undefined;
      const elementHasBorderColor: boolean = element.businessObject.di.stroke !== undefined;

      const elementHasColor: boolean = elementHasFillColor || elementHasBorderColor;

      return elementHasColor;
    });

    const noElementsWithColor: boolean = elementsWithColor.length === 0;
    if (noElementsWithColor) {
      return xml;
    }

    modeling.setColor(elementsWithColor, {
      stroke: defaultBpmnColors.none.border,
      fill: defaultBpmnColors.none.fill,
    });

    const clearedXml: string = await this.exportXmlFromDiagramModeler(diagramModeler);

    this.killModeler(diagramModeler);

    return clearedXml;
  }

  public async getColorizedDiagram(
    identity: IIdentity,
    xml: string,
    processInstanceId: string,
    processEngineSupportsGettingFlowNodeInstances?: boolean,
  ): Promise<string> {
    const diagramModeler: IBpmnModeler = new bundle.modeler();

    const result = await diagramModeler.importXML(xml);
    const {warnings} = result;

    const illegalIdErrors = getIllegalIdErrors(warnings);
    if (illegalIdErrors.length > 0) {
      const {xml: newXml} = getValidXml(xml, illegalIdErrors);
      return this.getColorizedDiagram(
        identity,
        newXml,
        processInstanceId,
        processEngineSupportsGettingFlowNodeInstances,
      );
    }

    const modeling = diagramModeler.get('modeling');
    const elementRegistry = diagramModeler.get('elementRegistry');

    const elementsWithActiveToken: Array<IShape> = await this.getElementsWithActiveToken(
      identity,
      processInstanceId,
      elementRegistry,
    );
    const elementsWithTokenHistory: Array<IShape> = await this.getElementsWithTokenHistory(
      identity,
      processInstanceId,
      elementRegistry,
    );

    this.colorizeElements(modeling, elementsWithTokenHistory, defaultBpmnColors.green);
    this.colorizeElements(modeling, elementsWithActiveToken, defaultBpmnColors.orange);

    if (processEngineSupportsGettingFlowNodeInstances) {
      const elementsWithError: Array<IShape> = await this.getElementsWithError(
        identity,
        processInstanceId,
        elementRegistry,
      );

      this.colorizeElements(modeling, elementsWithError, defaultBpmnColors.red);
    }

    const colorizedXml: string = await this.exportXmlFromDiagramModeler(diagramModeler);

    this.killModeler(diagramModeler);

    return colorizedXml;
  }

  public terminateProcess(identity: IIdentity, processInstanceId: string): Promise<void> {
    return this.liveExecutionTrackerRepository.terminateProcess(identity, processInstanceId);
  }

  public async getElementsWithError(
    identity: IIdentity,
    processInstanceId: string,
    elementRegistry: IElementRegistry,
  ): Promise<Array<IShape>> {
    const flowNodeInstanceList: DataModels.FlowNodeInstances.FlowNodeInstanceList = await this.liveExecutionTrackerRepository.getFlowNodeInstancesForProcessInstance(
      identity,
      processInstanceId,
    );

    return flowNodeInstanceList.flowNodeInstances
      .filter((flowNodeInstance: DataModels.FlowNodeInstances.FlowNodeInstance) => {
        return flowNodeInstance.state === 'error';
      })
      .map((flowNodeInstance: DataModels.FlowNodeInstances.FlowNodeInstance) => {
        return elementRegistry.get(flowNodeInstance.flowNodeId);
      });
  }

  private getAllElementsThatCanHaveAToken(elementRegistry: IElementRegistry): Array<IShape> {
    const allElementsThatCanHaveAToken: Array<IShape> = elementRegistry.filter((element: IShape): boolean => {
      const elementCanHaveAToken: boolean =
        element.type !== 'bpmn:SequenceFlow' &&
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Participant' &&
        element.type !== 'bpmn:Lane' &&
        element.type !== 'label';

      return elementCanHaveAToken;
    });

    return allElementsThatCanHaveAToken;
  }

  private getOutgoingElementsOfElement(
    element: IShape,
    tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup,
    elementRegistry: IElementRegistry,
  ): Array<IShape> {
    const outgoingElementsAsIModdleElement: Array<IModdleElement> = element.businessObject.outgoing;

    const elementHasNoOutgoingElements: boolean = outgoingElementsAsIModdleElement === undefined;
    if (elementHasNoOutgoingElements) {
      return [];
    }

    const elementsWithOutgoingElements: Array<IShape> = [];

    for (const outgoingElement of outgoingElementsAsIModdleElement) {
      const outgoingElementAsShape: IShape = elementRegistry.get(outgoingElement.id);
      const targetOfOutgoingElement: IShape = outgoingElementAsShape.target;

      const outgoingElementHasNoTarget: boolean = targetOfOutgoingElement === undefined;

      if (outgoingElementHasNoTarget) {
        continue;
      }

      const targetOfOutgoingElementHasNoTokenHistory: boolean = !this.elementHasTokenHistory(
        targetOfOutgoingElement.id,
        tokenHistoryGroups,
      );

      if (targetOfOutgoingElementHasNoTokenHistory) {
        continue;
      }

      const outgoingElementIsSequenceFlow: boolean = outgoingElementAsShape.type === 'bpmn:SequenceFlow';
      if (outgoingElementIsSequenceFlow) {
        const tokenHistoryForTarget: DataModels.TokenHistory.TokenHistoryEntry =
          tokenHistoryGroups[targetOfOutgoingElement.id].tokenHistoryEntries[0];
        const previousFlowNodeInstanceIdOfTarget: string = tokenHistoryForTarget.previousFlowNodeInstanceId;

        const tokenHistoryForElement: DataModels.TokenHistory.TokenHistoryEntry =
          tokenHistoryGroups[element.id].tokenHistoryEntries[0];
        const flowNodeInstanceIdOfElement: string = tokenHistoryForElement.flowNodeInstanceId;

        // This is needed because the ParallelGateway only knows the flowNodeId of the first element that reaches the ParallelGateway
        const targetOfOutgoingElementIsGateway: boolean = targetOfOutgoingElement.type === 'bpmn:ParallelGateway';
        const sequenceFlowWasExecuted: boolean = previousFlowNodeInstanceIdOfTarget === flowNodeInstanceIdOfElement;

        const outgoingElementWasUsed: boolean = sequenceFlowWasExecuted || targetOfOutgoingElementIsGateway;
        if (outgoingElementWasUsed) {
          elementsWithOutgoingElements.push(outgoingElementAsShape);
        }

        continue;
      }

      elementsWithOutgoingElements.push(outgoingElementAsShape);
    }

    return elementsWithOutgoingElements;
  }

  private killModeler(modeler: IBpmnModeler): void {
    modeler.destroy();
  }

  private getCallActivities(elementRegistry: IElementRegistry): Array<IShape> {
    const callActivities: Array<IShape> = elementRegistry.filter((element: IShape): boolean => {
      return element.type === 'bpmn:CallActivity';
    });

    return callActivities;
  }

  private async exportXmlFromDiagramModeler(diagramModeler: IBpmnModeler): Promise<string> {
    const xmlSaveOptions: IBpmnXmlSaveOptions = {
      format: true,
    };

    const {xml} = await diagramModeler.saveXML(xmlSaveOptions);
    return xml;
  }

  private colorizeElements(modeling: IModeling, elements: Array<IShape>, color: IColorPickerColor): void {
    const noElementsToColorize: boolean = elements === undefined || elements.length === 0;
    if (noElementsToColorize) {
      return;
    }

    try {
      modeling.setColor(elements, {
        stroke: color.border,
        fill: color.fill,
      });
    } catch {
      throw new Error('Adding color to some elements failed.');
    }
  }
}
