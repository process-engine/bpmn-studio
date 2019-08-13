import {bindable, inject} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {
  IBpmnModeler,
  ICanvas,
  IDiagramExportService,
  IElementRegistry,
  IEvent,
  ISolutionEntry,
  NotificationType,
} from '../../../../../contracts/index';
import environment from '../../../../../environment';
import {NotificationService} from '../../../../../services/notification-service/notification.service';
import {DiagramExportService} from '../../../../design/bpmn-io/services/index';
import {ILiveExecutionTrackerService} from '../../../../live-execution-tracker/contracts';

@inject('NotificationService', EventAggregator, 'LiveExecutionTrackerService')
export class DiagramViewer {
  @bindable public processInstance: DataModels.Correlations.CorrelationProcessInstance;
  @bindable public xml: string;
  @bindable public activeDiagram: IDiagram;
  @bindable public selectedFlowNode: IShape;
  @bindable public activeSolutionEntry: ISolutionEntry;
  public noCorrelationsFound: boolean;
  public xmlIsNotSelected: boolean = true;
  public canvasModel: HTMLElement;

  private notificationService: NotificationService;
  private elementRegistry: IElementRegistry;
  private diagramViewer: IBpmnModeler;
  private xmlWithColorizedProgress: string;
  private uncoloredSVG: string;
  private subscriptions: Array<Subscription>;
  private diagramExportService: IDiagramExportService;
  private eventAggregator: EventAggregator;
  private flowNodeToSetAfterProcessInstanceIsSet: string;
  private liveExecutionTrackerService: ILiveExecutionTrackerService;

  constructor(
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    liveExecutionTrackerService: ILiveExecutionTrackerService,
  ) {
    this.notificationService = notificationService;
    this.diagramExportService = new DiagramExportService();
    this.eventAggregator = eventAggregator;
    this.liveExecutionTrackerService = liveExecutionTrackerService;
  }

  public attached(): void {
    // eslint-disable-next-line 6river/new-cap
    this.diagramViewer = new bundle.viewer({
      additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule],
    });

    this.elementRegistry = this.diagramViewer.get('elementRegistry');

    this.diagramViewer.attachTo(this.canvasModel);

    this.diagramViewer.on('element.click', async (event: IEvent) => {
      this.selectFlowNode(event.element.id);
    });

    this.subscriptions = [
      this.eventAggregator.subscribe(`${environment.events.inspect.exportDiagramAs}:BPMN`, async () => {
        try {
          const exportName: string = `${this.activeDiagram.name}.bpmn`;
          await this.diagramExportService
            .loadXML(this.xmlWithColorizedProgress)
            .asBpmn()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.inspect.exportDiagramAs}:SVG`, async () => {
        try {
          const exportName: string = `${this.activeDiagram.name}.svg`;
          await this.diagramExportService
            .loadSVG(this.uncoloredSVG)
            .asSVG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.inspect.exportDiagramAs}:PNG`, async () => {
        try {
          const exportName: string = `${this.activeDiagram.name}.png`;
          await this.diagramExportService
            .loadSVG(this.uncoloredSVG)
            .asPNG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.inspect.exportDiagramAs}:JPEG`, async () => {
        try {
          const exportName: string = `${this.activeDiagram.name}.jpeg`;
          await this.diagramExportService
            .loadSVG(this.uncoloredSVG)
            .asJPEG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(
        environment.events.inspectCorrelation.noCorrelationsFound,
        (noCorrelationsFound: boolean) => {
          this.noCorrelationsFound = noCorrelationsFound;
        },
      ),
    ];

    document.addEventListener('keydown', (event: KeyboardEvent): void => {
      const noElementSelected: boolean = this.selectFlowNode === undefined;
      if (noElementSelected) {
        return;
      }

      const rightKeyPressed: boolean = event.code === 'ArrowRight';
      const leftKeyPressed: boolean = event.code === 'ArrowLeft';

      if (leftKeyPressed) {
        const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();
        const elementsOnTheLeft: Array<IShape> = this.filterElementsOnTheLeftOfTheSelected(elementsThatCanHaveAToken);

        const noElementsAreOnTheLeftOfTheSelected: boolean = elementsOnTheLeft.length === 0;
        if (noElementsAreOnTheLeftOfTheSelected) {
          return;
        }

        const elementsOnTheLeftFilteredByYAxis: Array<IShape> = this.filterElementsByYAxis(elementsOnTheLeft);

        const elementsOnTheLeftFilteredByYAxisIsNotEmpty: boolean = elementsOnTheLeftFilteredByYAxis.length > 0;
        const elementsToWorkWith: Array<IShape> = elementsOnTheLeftFilteredByYAxisIsNotEmpty
          ? elementsOnTheLeftFilteredByYAxis
          : elementsOnTheLeft;

        const closestElementOnTheLeft: IShape = this.getClosestElementByX(elementsToWorkWith);

        this.selectFlowNode(closestElementOnTheLeft.id);
      }

      if (rightKeyPressed) {
        const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();
        const elementsOnTheRight: Array<IShape> = this.filterElementsOnTheRightOfTheSelected(elementsThatCanHaveAToken);

        const noElementsAreOnTheRightOfTheSelected: boolean = elementsOnTheRight.length === 0;
        if (noElementsAreOnTheRightOfTheSelected) {
          return;
        }

        const elementsOnTheRightFilteredByYAxis: Array<IShape> = this.filterElementsByYAxis(elementsOnTheRight);

        const elementsOnTheSameHeightOnTheRightIsNotEmpty: boolean = elementsOnTheRightFilteredByYAxis.length > 0;
        const elementsToWorkWith: Array<IShape> = elementsOnTheSameHeightOnTheRightIsNotEmpty
          ? elementsOnTheRightFilteredByYAxis
          : elementsOnTheRight;

        const closestElementOnTheRight: IShape = this.getClosestElementByX(elementsToWorkWith);

        this.selectFlowNode(closestElementOnTheRight.id);
      }
    });
  }

  private getClosestElementByX(elements: Array<IShape>): IShape {
    return elements.reduce(
      (previousElement: IShape, currentElement: IShape): IShape => {
        const noPreviousElementExists: boolean = previousElement === undefined;
        if (noPreviousElementExists) {
          return currentElement;
        }

        const distancePreviousElement: number = Math.abs(this.selectedFlowNode.x - previousElement.x);
        const distanceCurrentElement: number = Math.abs(this.selectedFlowNode.x - currentElement.x);

        const currentElementIsCloser: boolean = distanceCurrentElement < distancePreviousElement;
        return currentElementIsCloser ? currentElement : previousElement;
      },
    );
  }

  private getElementsThatCanHaveAToken(): Array<IShape> {
    return this.elementRegistry.filter((element: IShape) => {
      const elementCanHaveAToken: boolean =
        element.type !== 'bpmn:Participant' &&
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Lane' &&
        element.type !== 'bpmn:LaneSet' &&
        element.type !== 'label' &&
        element.type !== 'bpmn:SequenceFlow';

      return elementCanHaveAToken;
    });
  }

  private filterElementsOnTheRightOfTheSelected(elementsToFilter: Array<IShape>): Array<IShape> {
    return elementsToFilter.filter((element: IShape): boolean => {
      const elementIsOnTheRightOfTheSelectedFlowNode: boolean = this.selectedFlowNode.x < element.x;

      return elementIsOnTheRightOfTheSelectedFlowNode;
    });
  }

  private filterElementsOnTheLeftOfTheSelected(elementsToFilter: Array<IShape>): Array<IShape> {
    return elementsToFilter.filter((element: IShape): boolean => {
      const elementIsOnTheLeftOfTheSelectedFlowNode: boolean = this.selectedFlowNode.x > element.x;

      return elementIsOnTheLeftOfTheSelectedFlowNode;
    });
  }

  private filterElementsByYAxis(elementsToFilter: Array<IShape>): Array<IShape> {
    return elementsToFilter.filter((element: IShape): boolean => {
      const elementStartsBetweenSelectedElement: boolean =
        element.y >= this.selectedFlowNode.y && element.y <= this.selectedFlowNode.y + this.selectedFlowNode.height;

      const elementEndsBetweenSelectedElement: boolean =
        element.y + element.height >= this.selectedFlowNode.y &&
        element.y + element.height <= this.selectedFlowNode.y + this.selectedFlowNode.height;

      const elementStartsBeforeSelectedAndEndsAfterSelected: boolean =
        this.selectedFlowNode.y > element.y &&
        this.selectedFlowNode.y + this.selectedFlowNode.height < element.y + element.height;

      return (
        elementStartsBetweenSelectedElement ||
        elementEndsBetweenSelectedElement ||
        elementStartsBeforeSelectedAndEndsAfterSelected
      );
    });
  }

  public selectFlowNode(flowNodeId: string): void {
    if (this.processInstance === undefined) {
      this.flowNodeToSetAfterProcessInstanceIsSet = flowNodeId;

      return;
    }

    const element: IShape = this.elementRegistry.get(flowNodeId);

    this.selectedFlowNode = element;
    this.diagramViewer.get('selection').select(element);
  }

  public detached(): void {
    const bjsContainer: Element = this.canvasModel.getElementsByClassName('bjs-container')[0];

    const bjsContainerIsExisting: boolean =
      this.canvasModel !== undefined &&
      this.canvasModel !== null &&
      this.canvasModel.childElementCount > 1 &&
      bjsContainer !== undefined &&
      bjsContainer !== null;

    if (bjsContainerIsExisting) {
      this.canvasModel.removeChild(bjsContainer);
    }

    const diagramViewerIsExisting: boolean = this.diagramViewer !== undefined;

    if (diagramViewerIsExisting) {
      this.diagramViewer.detach();
      this.diagramViewer.destroy();

      this.diagramViewer = undefined;
      this.xml = undefined;
      this.xmlIsNotSelected = true;
    }

    this.subscriptions.forEach((subscription: Subscription) => subscription.dispose());
  }

  public async processInstanceChanged(): Promise<void> {
    const noProcessInstanceSelected: boolean = this.processInstance === undefined;
    if (noProcessInstanceSelected) {
      return;
    }

    this.xml = this.processInstance.xml;

    const uncoloredXml: string = await this.liveExecutionTrackerService.clearDiagramColors(this.xml);

    this.xmlWithColorizedProgress = await this.liveExecutionTrackerService.getColorizedDiagram(
      this.activeSolutionEntry.identity,
      uncoloredXml,
      this.processInstance.processInstanceId,
      true,
    );

    await this.importXml(this.xmlWithColorizedProgress);
    this.uncoloredSVG = await this.getSVG();

    const elementSelected: boolean = this.selectedFlowNode !== undefined;
    if (elementSelected) {
      const previouslySelectedElementFound: boolean = this.elementRegistry.getAll().some((element: IShape) => {
        const isSelectedElement: boolean = element.id === this.selectedFlowNode.id;

        return isSelectedElement;
      });

      if (previouslySelectedElementFound) {
        this.selectFlowNode(this.selectedFlowNode.id);
      } else {
        this.selectStartEvent();
      }
    } else {
      this.selectStartEvent();
    }

    this.fitDiagramToViewport();

    const flowNodeNeedsToBeSelected: boolean = this.flowNodeToSetAfterProcessInstanceIsSet !== undefined;
    if (flowNodeNeedsToBeSelected) {
      this.selectFlowNode(this.flowNodeToSetAfterProcessInstanceIsSet);

      this.flowNodeToSetAfterProcessInstanceIsSet = undefined;
    }
  }

  public activeDiagramChanged(): void {
    const diagramViewerIsNotSet: boolean = this.diagramViewer === undefined;

    if (diagramViewerIsNotSet) {
      return;
    }

    this.diagramViewer.clear();
    this.xmlIsNotSelected = true;
    this.noCorrelationsFound = false;
    this.xml = undefined;

    this.fitDiagramToViewport();
  }

  public xmlChanged(): void {
    this.xmlIsNotSelected = this.xml === undefined;
  }

  private selectStartEvent(): void {
    const startEvent: IShape = this.elementRegistry.filter((element: IShape): boolean => {
      return element.type === 'bpmn:StartEvent';
    })[0];

    this.selectFlowNode(startEvent.id);
  }

  private fitDiagramToViewport(): void {
    const canvas: ICanvas = this.diagramViewer.get('canvas');
    canvas.zoom('fit-viewport', 'auto');
  }

  private async importXml(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;

    if (xmlIsNotLoaded) {
      const notificationMessage: string =
        'The xml could not be loaded. Please try to reopen the Inspect Correlation View.';
      this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);

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

  private async getSVG(): Promise<string> {
    const returnPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      this.diagramViewer.saveSVG({format: true}, (error: Error, result: string) => {
        if (error) {
          reject(error);
        }

        resolve(result);
      });
    });

    return returnPromise;
  }
}
