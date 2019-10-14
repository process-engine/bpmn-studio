import {IIdentity} from '@essential-projects/iam_contracts';
import {IConnection, IShape} from '@process-engine/bpmn-elements_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {
  IBpmnModeler,
  IColorPickerColor,
  IElementRegistry,
  IModeling,
  IOverlayManager,
  IOverlayPosition,
  ISolutionEntry,
  defaultBpmnColors,
} from '../../../../contracts/index';
import {
  IFlowNodeAssociation,
  IHeatmapRepository,
  IHeatmapService,
  ITokenPositionAndCount,
  defaultOverlayPositions,
} from '../contracts/index';
import environment from '../../../../environment';
import {processEngineSupportsPagination} from '../../../../services/process-engine-version-module/process-engine-version.module';
import {HeatmapPaginationRepository} from '../repositories/heatmap.pagination-repository';
import {HeatmapRepository} from '../repositories/heatmap.repository';

// maximalTokenCount is used to sanitise the displayed number to "99+"
const maximalTokenCount: number = 100;

export class HeatmapService implements IHeatmapService {
  private heatmapRepository: IHeatmapRepository;
  private eventAggregator: EventAggregator;
  private managementApiClient: IManagementApiClient;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    this.eventAggregator = eventAggregator;
    this.managementApiClient = managementApiClient;

    this.eventAggregator.subscribe(
      environment.events.configPanel.solutionEntryChanged,
      (solutionEntry: ISolutionEntry) => {
        if (processEngineSupportsPagination(solutionEntry.processEngineVersion)) {
          this.heatmapRepository = new HeatmapPaginationRepository(this.managementApiClient);
        } else {
          this.heatmapRepository = new HeatmapRepository(this.managementApiClient);
        }
      },
    );
  }

  public getRuntimeInformationForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList> {
    return this.heatmapRepository.getRuntimeInformationForProcessModel(identity, processModelId);
  }

  public getActiveTokensForFlowNode(identity: IIdentity, flowNodeId: string): Promise<DataModels.Kpi.ActiveTokenList> {
    return this.heatmapRepository.getActiveTokensForFlowNode(identity, flowNodeId);
  }

  /**
   *
   * @param overlays IOverlayManager; The overlay module from bpmn-js
   * @param elementRegistry IElementRegistry; The elementRegistry module from bpmn-js
   *
   * This method adds overlays for the activeTokens to the diagram viewer.
   */
  public async addOverlays(
    identity: IIdentity,
    overlays: IOverlayManager,
    elementRegistry: IElementRegistry,
    processModelId: string,
  ): Promise<void> {
    let participantsTokenCount: number = 0;

    const addOverlay: (elementId: string, count: number, position: IOverlayPosition) => void = (
      elementId: string,
      count: number,
      position: IOverlayPosition,
    ): void => {
      const countIsTooHigh: boolean = count >= maximalTokenCount;

      overlays.add(elementId, {
        position: {
          left: position.left,
          top: position.top,
        },
        html: `<div class="heatmap__overlay" title="This element has actual ${count} token.">${
          countIsTooHigh ? '99+' : count
        }</div>`,
      });
    };

    const elementsForOverlays: Array<IShape> = this.getElementsForOverlays(elementRegistry);
    const activeTokenListArray: Array<DataModels.Kpi.ActiveTokenList> = await this.getActiveTokenListArray(
      identity,
      elementsForOverlays,
      processModelId,
    );

    this.addShapeTypeToActiveToken(activeTokenListArray, elementsForOverlays);

    const elementsWithoutToken: Array<IShape> = this.getElementsWithoutToken(elementsForOverlays, activeTokenListArray);

    activeTokenListArray.forEach((activeTokenList: DataModels.Kpi.ActiveTokenList) => {
      const activeTokenArray = activeTokenList.activeTokens as Array<DataModels.Kpi.ActiveToken & {type: string}>;

      const elementIsEvent: boolean = this.elementIsEvent(activeTokenArray[0].type);
      const elementIsGateway: boolean = this.elementIsGateway(activeTokenArray[0].type);
      const elementIsTask: boolean = this.elementIsTask(activeTokenArray[0].type);

      if (elementIsGateway) {
        addOverlay(activeTokenArray[0].flowNodeId, activeTokenArray.length, defaultOverlayPositions.gateways);
      } else if (elementIsEvent) {
        addOverlay(activeTokenArray[0].flowNodeId, activeTokenArray.length, defaultOverlayPositions.events);
      } else if (elementIsTask) {
        addOverlay(activeTokenArray[0].flowNodeId, activeTokenArray.length, defaultOverlayPositions.tasks);
      }

      participantsTokenCount += activeTokenArray.length;
    });

    elementsWithoutToken.forEach((element: IShape) => {
      const elementIsEvent: boolean = this.elementIsEvent(element.type);
      const elementIsGateway: boolean = this.elementIsGateway(element.type);
      const elementIsTask: boolean = this.elementIsTask(element.type);

      if (elementIsGateway) {
        addOverlay(element.id, 0, defaultOverlayPositions.gateways);
      } else if (elementIsEvent) {
        addOverlay(element.id, 0, defaultOverlayPositions.events);
      } else if (elementIsTask) {
        addOverlay(element.id, 0, defaultOverlayPositions.tasks);
      }
    });

    const participantShape: IShape = this.getParticipantShape(elementRegistry);
    addOverlay(participantShape.id, participantsTokenCount, {
      left: participantShape.width - defaultOverlayPositions.participants.left,
      top: participantShape.height - defaultOverlayPositions.participants.top,
    });
  }

  public getProcess(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel> {
    return this.heatmapRepository.getProcess(identity, processModelId);
  }

  /**
   *
   * @param elementRegistry IElementRegistry; The elementRegistry module from bpmn-js
   *
   * This method finds all associations (IConnection) on flowNodes which are defined with 'RT:'
   * and returns them as IFlowNodeAssociation.
   *
   * A flowNodeAssociation contains the associationId, the elementId with which
   * it is connected and the expected runtime.
   *
   */
  public getFlowNodeAssociations(elementRegistry: IElementRegistry): Array<IFlowNodeAssociation> {
    const flowNodeAssociations: Array<IFlowNodeAssociation> = [];

    const associations: Array<IConnection> = elementRegistry.filter((element: IShape) => {
      const elementIsNoValidAssociation: boolean =
        element.target === undefined ||
        element.target.businessObject === undefined ||
        element.target.businessObject.text === undefined;

      if (elementIsNoValidAssociation) {
        return false;
      }

      const elementIsAssociation: boolean = element.type === 'bpmn:Association';
      const annotationHasRuntime: boolean = element.target.businessObject.text.includes('RT:');

      return elementIsAssociation && annotationHasRuntime;
    });

    associations.forEach((association: IConnection) => {
      const medianRunTime: number = this.getMedianRunTimeForAssociation(association);

      const flowNodeAssociation: IFlowNodeAssociation = {
        associationId: association.id,
        sourceId: association.source.id,
        runtime_medianInMs: medianRunTime,
      };

      flowNodeAssociations.push(flowNodeAssociation);
    });

    return flowNodeAssociations;
  }

  /**
   *
   * @param associations Array<IFlowNodeAssociation>;
   * @param flowNodeRuntimeInformation Array<DataModels.Kpi.FlowNodeRuntimeInformation>; RuntimeInformation which comes from the backend.
   * @param modeler IBpmnModeler; The bpmn-js diagram modeler (only the modeler can color elements).
   *
   * Checks if the runtime for a flowNode is greater than expected and colors the element
   * depending on the result.
   *
   * greater => red
   * smaller => green
   *
   */
  public async getColoredXML(
    associations: Array<IFlowNodeAssociation>,
    flowNodeRuntimeInformation: Array<DataModels.Kpi.FlowNodeRuntimeInformation>,
    modeler: IBpmnModeler,
  ): Promise<string> {
    const elementRegistry: IElementRegistry = modeler.get('elementRegistry');
    const modeling: IModeling = modeler.get('modeling');

    const elementsToColor: Array<DataModels.Kpi.FlowNodeRuntimeInformation> = this.getElementsToColor(
      associations,
      flowNodeRuntimeInformation,
    );

    associations.forEach((association: IFlowNodeAssociation) => {
      const elementToColor: DataModels.Kpi.FlowNodeRuntimeInformation = elementsToColor.find(
        (element: DataModels.Kpi.FlowNodeRuntimeInformation) => {
          return element.flowNodeId === association.sourceId;
        },
      );

      const elementToColorIsUndefined: boolean = elementToColor === undefined;

      if (elementToColorIsUndefined) {
        return;
      }

      const shapeToColor: IShape = this.getShape(elementRegistry, elementToColor);
      const flowNodeRuntimeIsGreaterThanExpected: boolean =
        elementToColor.medianRuntimeInMs > association.runtime_medianInMs;

      if (flowNodeRuntimeIsGreaterThanExpected) {
        this.colorElement(modeling, shapeToColor, defaultBpmnColors.red);
      } else {
        this.colorElement(modeling, shapeToColor, defaultBpmnColors.green);
      }
    });

    const xml: string = await this.getXmlFromModeler(modeler);

    return xml;
  }

  private colorElement(modeling: IModeling, shapeToColor: IShape, color: IColorPickerColor): void {
    modeling.setColor(shapeToColor, {
      stroke: color.border,
      fill: color.fill,
    });
  }

  /**
   *
   * @param associations Array<IFlowNodeAssociation>; Expected runtime information.
   * @param flowNodeRuntimeInformation Array<DataModels.Kpi.FlowNodeRuntimeInformation>; RuntimeInformation which comes from the backend.
   *
   * Returns the flowNodeRuntimeInformation from the elements which must get colored.
   */
  private getElementsToColor(
    associations: Array<IFlowNodeAssociation>,
    flowNodeRuntimeInformation: Array<DataModels.Kpi.FlowNodeRuntimeInformation>,
  ): Array<DataModels.Kpi.FlowNodeRuntimeInformation> {
    const elementsToColor: Array<DataModels.Kpi.FlowNodeRuntimeInformation> = flowNodeRuntimeInformation.filter(
      (information: DataModels.Kpi.FlowNodeRuntimeInformation) => {
        const associationWithSameId: IFlowNodeAssociation = associations.find((association: IFlowNodeAssociation) => {
          return association.sourceId === information.flowNodeId;
        });

        return associationWithSameId;
      },
    );

    return elementsToColor;
  }

  /**
   *
   * @param elementRegistry IElementRegistry;
   * @param elementToColor FlowNodeRuntimeInformation | ITokenPositionAndCount | ActiveToken;
   *
   * Returns the IShape of an element.
   * The IShape is needed by the IModeling module from bpmn-js to color an element.
   */
  private getShape(
    elementRegistry: IElementRegistry,
    elementToColor: DataModels.Kpi.FlowNodeRuntimeInformation | ITokenPositionAndCount | DataModels.Kpi.ActiveToken,
  ): IShape {
    const elementShape: IShape = elementRegistry.get(elementToColor.flowNodeId);

    return elementShape;
  }

  private getParticipantShape(elementRegistry: IElementRegistry): IShape {
    const allElements: Array<IShape> = elementRegistry.getAll();

    const participantShape: IShape = allElements.find((element: IShape) => {
      const elementIsParticipant: boolean = element.type === 'bpmn:Participant';

      return elementIsParticipant;
    });

    return participantShape;
  }

  private getElementsForOverlays(elementRegistry: IElementRegistry): Array<IShape> {
    const allElements: Array<IShape> = elementRegistry.getAll();
    const filteredElements: Array<IShape> = allElements.filter((element: IShape) => {
      const condition: boolean =
        element.type !== 'bpmn:Association' &&
        element.type !== 'bpmn:SequenceFlow' &&
        element.type !== 'bpmn:TextAnnotation' &&
        element.type !== 'bpmn:Participant' &&
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Lane' &&
        element.type !== 'label';

      return condition;
    });

    return filteredElements;
  }

  private async getXmlFromModeler(modeler: IBpmnModeler): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      modeler.saveXML({format: true}, async (saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
  }

  private getMedianRunTimeForAssociation(association: IConnection): number {
    const annotationText: string = association.target.businessObject.text;
    const lengthOfRTStamp: number = 4;
    const startRunTimeText: number = annotationText.search('RT:') + lengthOfRTStamp;
    const lengthOfRunTimeText: number = 12;
    const runTimeTimeStamp: string = annotationText.substr(startRunTimeText, lengthOfRunTimeText);
    const date: Date = new Date(`1970-01-01T${runTimeTimeStamp}Z`);
    const medianRunTimeInMs: number = date.getTime();

    return medianRunTimeInMs;
  }

  private async getActiveTokenListArray(
    identity: IIdentity,
    elementsForOverlays: Array<IShape>,
    processModelId: string,
  ): Promise<Array<DataModels.Kpi.ActiveTokenList>> {
    const promisesForElements: Array<Promise<DataModels.Kpi.ActiveTokenList>> = elementsForOverlays.map(
      async (element: IShape) => {
        const activeTokenList: DataModels.Kpi.ActiveTokenList = await this.getActiveTokensForFlowNode(
          identity,
          element.id,
        );

        const elementActiveTokensForProcessModel: Array<
          DataModels.Kpi.ActiveToken
        > = activeTokenList.activeTokens.filter((token: DataModels.Kpi.ActiveToken) => {
          const tokenIsInProcessModel: boolean = token.processModelId === processModelId;

          return tokenIsInProcessModel;
        });

        return {
          activeTokens: elementActiveTokensForProcessModel,
          totalCount: elementActiveTokensForProcessModel.length,
        };
      },
    );

    const activeTokenListArrayForAllElements: Array<DataModels.Kpi.ActiveTokenList> = await Promise.all(
      promisesForElements,
    );

    const filteredActiveTokenListArray: Array<
      DataModels.Kpi.ActiveTokenList
    > = activeTokenListArrayForAllElements.filter((element: DataModels.Kpi.ActiveTokenList) => {
      const arrayIsNotEmpty: boolean = element.totalCount !== 0;

      return arrayIsNotEmpty;
    });

    return filteredActiveTokenListArray;
  }

  private addShapeTypeToActiveToken(
    activeTokenListArray: Array<DataModels.Kpi.ActiveTokenList>,
    elementsForOverlays: Array<IShape>,
  ): void {
    activeTokenListArray.forEach((activeTokenList: DataModels.Kpi.ActiveTokenList) => {
      const elementOfActiveToken: IShape = elementsForOverlays.find((element: IShape) => {
        const isCorrectElement: boolean = element.id === activeTokenList.activeTokens[0].flowNodeId;

        return isCorrectElement;
      });

      // eslint-disable-next-line no-param-reassign
      (activeTokenList.activeTokens[0] as any).type = elementOfActiveToken.type;
    });
  }

  private getElementsWithoutToken(
    elementsForOverlays: Array<IShape>,
    activeTokenListArray: Array<DataModels.Kpi.ActiveTokenList>,
  ): Array<IShape> {
    const elementsWithoutToken: Array<IShape> = elementsForOverlays.filter((element: IShape) => {
      const activeTokenForElement: DataModels.Kpi.ActiveTokenList = activeTokenListArray.find(
        (activeTokenList: DataModels.Kpi.ActiveTokenList) => {
          return activeTokenList.activeTokens[0].flowNodeId === element.id;
        },
      );

      const noActiveTokenForElement: boolean = activeTokenForElement === undefined;

      return noActiveTokenForElement;
    });

    return elementsWithoutToken;
  }

  private elementIsEvent(type: string): boolean {
    const elementTypeIsEvent: boolean =
      type === 'bpmn:StartEvent' ||
      type === 'bpmn:EndEvent' ||
      type === 'bpmn:IntermediateThrowEvent' ||
      type === 'bpmn:IntermediateCatchEvent' ||
      type === 'bpmn:BoundaryEvent';

    return elementTypeIsEvent;
  }

  private elementIsGateway(type: string): boolean {
    const elementTypeIsGateway: boolean =
      type === 'bpmn:ExclusiveGateway' ||
      type === 'bpmn:ParallelGateway' ||
      type === 'bpmn:InclusiveGateway' ||
      type === 'bpmn:ComplexGateway' ||
      type === 'bpmn:EventBasedGateway';

    return elementTypeIsGateway;
  }

  private elementIsTask(type: string): boolean {
    const elementTypeIsTask: boolean =
      type === 'bpmn:UserTask' ||
      type === 'bpmn:ScriptTask' ||
      type === 'bpmn:ServiceTask' ||
      type === 'bpmn:Task' ||
      type === 'bpmn:SendTask' ||
      type === 'bpmn:ReceiveTask' ||
      type === 'bpmn:ManualTask' ||
      type === 'bpmn:BusinessRuleTask' ||
      type === 'bpmn:CallActivity' ||
      type === 'bpmn:SubProcess';

    return elementTypeIsTask;
  }
}
