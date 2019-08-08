import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {IShape} from '@process-engine/bpmn-elements_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

export interface ILiveExecutionTrackerService {
  finishEmptyActivity(
    processInstanceId: string,
    correlationId: string,
    emptyActivity: DataModels.EmptyActivities.EmptyActivity,
  ): Promise<void>;
  terminateProcess(processInstanceId: string): Promise<void>;

  getActiveTokensForProcessInstance(processInstanceId: string): Promise<Array<DataModels.Kpi.ActiveToken> | null>;
  getCorrelationById(correlationId: string): Promise<DataModels.Correlations.Correlation>;
  getEmptyActivitiesForProcessInstance(
    processInstanceId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList | null>;
  getProcessModelByProcessInstanceId(
    correlationId: string,
    processInstanceId: string,
  ): Promise<DataModels.Correlations.CorrelationProcessInstance>;
  getProcessModelById(processModelId: string): Promise<DataModels.ProcessModels.ProcessModel>;
  getTokenHistoryGroupForProcessInstance(
    processInstanceId: string,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | null>;

  getProcessInstanceIdOfCallActivityTarget(
    correlationId: string,
    processInstanceIdOfOrigin: string,
    callActivityTargetId: string,
  ): Promise<string>;
  getElementById(elementId: string): IShape;
  getAllElementsThatCanHaveAToken(): Array<IShape>;
  getElementsWithActiveToken(processInstanceId: string): Promise<Array<IShape> | null>;
  getElementsWithTokenHistory(processInstanceId: string): Promise<Array<IShape> | null>;
  getElementsWithError(processInstanceId: string): Promise<Array<IShape>>;
  getCallActivities(): Array<IShape>;
  getActiveCallActivities(processInstanceId: string): Promise<Array<IShape>>;
  getInactiveCallActivities(processInstanceId: string): Promise<Array<IShape>>;
  getOutgoingElementsOfElement(
    element: IShape,
    tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup,
  ): Array<IShape>;

  elementHasActiveToken(elementId: string, activeTokens: Array<DataModels.Kpi.ActiveToken>): boolean;
  elementHasTokenHistory(elementId: string, tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup): boolean;

  setIdentity(identity: IIdentity): void;

  importXmlIntoDiagramModeler(xml: string): Promise<void>;
  exportXmlFromDiagramModeler(): Promise<string>;
  clearDiagramColors(): void;
  getColorizedDiagram(
    processInstanceId: string,
    processEngineSupportsGettingFlowNodeInstances?: boolean,
  ): Promise<string>;

  isProcessInstanceActive(processInstanceId: string): Promise<boolean>;

  createProcessEndedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createProcessTerminatedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;

  createActivityReachedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createActivityFinishedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createEmptyActivityWaitingEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createEmptyActivityFinishedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createManualTaskWaitingEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createManualTaskFinishedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createUserTaskWaitingEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createUserTaskFinishedEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createBoundaryEventTriggeredEventListener(processInstanceId: string, callback: Function): Promise<Subscription>;
  createIntermediateThrowEventTriggeredEventListener(
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createIntermediateCatchEventReachedEventListener(
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createIntermediateCatchEventFinishedEventListener(
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;

  removeSubscription(subscription: Subscription): Promise<void>;
}
