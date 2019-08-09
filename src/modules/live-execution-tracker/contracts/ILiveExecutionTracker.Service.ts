import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {IShape} from '@process-engine/bpmn-elements_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

export interface ILiveExecutionTrackerService {
  finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivity: DataModels.EmptyActivities.EmptyActivity,
  ): Promise<void>;
  terminateProcess(identity: IIdentity, processInstanceId: string): Promise<void>;

  getActiveTokensForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<Array<DataModels.Kpi.ActiveToken> | null>;
  getCorrelationById(identity: IIdentity, correlationId: string): Promise<DataModels.Correlations.Correlation>;
  getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList | null>;
  getProcessModelByProcessInstanceId(
    identity: IIdentity,
    correlationId: string,
    processInstanceId: string,
  ): Promise<DataModels.Correlations.CorrelationProcessInstance>;
  getProcessModelById(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel>;
  getTokenHistoryGroupForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | null>;

  getProcessInstanceIdOfCallActivityTarget(
    identity: IIdentity,
    correlationId: string,
    processInstanceIdOfOrigin: string,
    callActivityTargetId: string,
  ): Promise<string>;
  getElementById(elementId: string): IShape;
  getAllElementsThatCanHaveAToken(identity: IIdentity): Array<IShape>;
  getElementsWithActiveToken(identity: IIdentity, processInstanceId: string): Promise<Array<IShape> | null>;
  getElementsWithTokenHistory(identity: IIdentity, processInstanceId: string): Promise<Array<IShape> | null>;
  getElementsWithError(identity: IIdentity, processInstanceId: string): Promise<Array<IShape>>;
  getCallActivities(identity: IIdentity): Array<IShape>;
  getActiveCallActivities(identity: IIdentity, processInstanceId: string): Promise<Array<IShape>>;
  getInactiveCallActivities(identity: IIdentity, processInstanceId: string): Promise<Array<IShape>>;
  getOutgoingElementsOfElement(
    element: IShape,
    tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup,
  ): Array<IShape>;

  elementHasActiveToken(elementId: string, activeTokens: Array<DataModels.Kpi.ActiveToken>): boolean;
  elementHasTokenHistory(elementId: string, tokenHistoryGroups: DataModels.TokenHistory.TokenHistoryGroup): boolean;

  importXmlIntoDiagramModeler(xml: string): Promise<void>;
  exportXmlFromDiagramModeler(): Promise<string>;
  clearDiagramColors(): void;
  getColorizedDiagram(
    identity: IIdentity,
    processInstanceId: string,
    processEngineSupportsGettingFlowNodeInstances?: boolean,
  ): Promise<string>;

  isProcessInstanceActive(identity: IIdentity, processInstanceId: string): Promise<boolean>;

  createProcessEndedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createProcessTerminatedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;

  createActivityReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createEmptyActivityWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createEmptyActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createManualTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createManualTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createUserTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createUserTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createBoundaryEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createIntermediateThrowEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createIntermediateCatchEventReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;
  createIntermediateCatchEventFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription>;

  removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void>;
}
