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
  @bindable public processInstance: DataModels.Correlations.ProcessInstance;
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
    if (!this.activeDiagram) {
      this.noCorrelationsFound = true;
    }
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
        environment.events.inspectProcessInstance.noCorrelationsFound,
        (noCorrelationsFound: boolean) => {
          this.noCorrelationsFound = noCorrelationsFound;
        },
      ),
    ];

    document.addEventListener('keydown', this.handleArrowKeyInput);
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
    document.removeEventListener('keydown', this.handleArrowKeyInput);
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
        'The xml could not be loaded. Please try to reopen the Inspect Process Instance view.';
      this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return undefined;
    }

    try {
      await this.diagramViewer.importXML(xml);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async getSVG(): Promise<string> {
    try {
      const {svg} = await this.diagramViewer.saveSVG({format: true});
      return Promise.resolve(svg);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private handleArrowKeyInput: EventListenerOrEventListenerObject = (event: KeyboardEvent): void => {
    const noElementSelected: boolean = this.selectedFlowNode === undefined;
    if (noElementSelected) {
      return;
    }

    const leftKeyPressed: boolean = event.code === 'ArrowLeft';
    const rightKeyPressed: boolean = event.code === 'ArrowRight';
    const topKeyPressed: boolean = event.code === 'ArrowUp';
    const bottomKeyPressed: boolean = event.code === 'ArrowDown';

    let elementToSelect: IShape;
    if (leftKeyPressed) {
      elementToSelect = this.getClosestElementOnTheLeftOfSelected();
    } else if (rightKeyPressed) {
      elementToSelect = this.getClosestElementOnTheRightOfSelected();
    } else if (topKeyPressed) {
      elementToSelect = this.getClosestElementAboveSelected();
    } else if (bottomKeyPressed) {
      elementToSelect = this.getClosestElementUnderSelected();
    }

    const elementToSelectNotFound: boolean = elementToSelect === undefined;
    if (elementToSelectNotFound) {
      return;
    }

    this.selectFlowNode(elementToSelect.id);
  };

  private getClosestElementOnTheLeftOfSelected(): IShape {
    const elementsOnTheLeft: Array<IShape> = this.getElementsOnTheLeftOfTheSelected();

    const noElementsAreOnTheLeftOfTheSelected: boolean = elementsOnTheLeft.length === 0;
    if (noElementsAreOnTheLeftOfTheSelected) {
      return undefined;
    }

    const elementsOnTheLeftOverlappingOnYAxis: Array<IShape> = this.filterElementsThatOverlapWithSelectedOnYAxis(
      elementsOnTheLeft,
    );

    const elementsOnTheLeftOverlappingOnYAxisIsNotEmpty: boolean = elementsOnTheLeftOverlappingOnYAxis.length > 0;
    const elementsToWorkWith: Array<IShape> = elementsOnTheLeftOverlappingOnYAxisIsNotEmpty
      ? elementsOnTheLeftOverlappingOnYAxis
      : elementsOnTheLeft;

    return this.getClosestElementByX(elementsToWorkWith);
  }

  private getClosestElementOnTheRightOfSelected(): IShape {
    const elementsOnTheRight: Array<IShape> = this.getElementsOnTheRightOfTheSelected();

    const noElementsAreOnTheRightOfTheSelected: boolean = elementsOnTheRight.length === 0;
    if (noElementsAreOnTheRightOfTheSelected) {
      return undefined;
    }

    const elementsOnTheRightOverlappingOnYAxis: Array<IShape> = this.filterElementsThatOverlapWithSelectedOnYAxis(
      elementsOnTheRight,
    );

    const elementsOnTheRightOverlappingOnYAxisIsNotEmpty: boolean = elementsOnTheRightOverlappingOnYAxis.length > 0;
    const elementsToWorkWith: Array<IShape> = elementsOnTheRightOverlappingOnYAxisIsNotEmpty
      ? elementsOnTheRightOverlappingOnYAxis
      : elementsOnTheRight;

    return this.getClosestElementByX(elementsToWorkWith);
  }

  private getClosestElementAboveSelected(): IShape {
    const elementsAboveSelected: Array<IShape> = this.getElementsAboveTheSelected();

    const noElementsAreAboveTheSelected: boolean = elementsAboveSelected.length === 0;
    if (noElementsAreAboveTheSelected) {
      return undefined;
    }

    const elementsAboveSelectedOverlappingOnXAxis: Array<IShape> = this.filterElementsThatOverlapWithSelectedOnXAxis(
      elementsAboveSelected,
    );

    const elementsAboveSelectedOverlappingOnXAxisIsNotEmpty: boolean =
      elementsAboveSelectedOverlappingOnXAxis.length > 0;
    const elementsToWorkWith: Array<IShape> = elementsAboveSelectedOverlappingOnXAxisIsNotEmpty
      ? elementsAboveSelectedOverlappingOnXAxis
      : elementsAboveSelected;

    return this.getClosestElementByY(elementsToWorkWith);
  }

  private getClosestElementUnderSelected(): IShape {
    const elementsUnderSelected: Array<IShape> = this.getElementsUnderTheSelected();

    const noElementsAreUnderTheSelected: boolean = elementsUnderSelected.length === 0;
    if (noElementsAreUnderTheSelected) {
      return undefined;
    }

    const elementsUnderSelectedOverlappingOnXAxis: Array<IShape> = this.filterElementsThatOverlapWithSelectedOnXAxis(
      elementsUnderSelected,
    );

    const elementsUnderSelectedOverlappingOnXAxisIsNotEmpty: boolean =
      elementsUnderSelectedOverlappingOnXAxis.length > 0;
    const elementsToWorkWith: Array<IShape> = elementsUnderSelectedOverlappingOnXAxisIsNotEmpty
      ? elementsUnderSelectedOverlappingOnXAxis
      : elementsUnderSelected;

    return this.getClosestElementByY(elementsToWorkWith);
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

  private getClosestElementByY(elements: Array<IShape>): IShape {
    return elements.reduce(
      (previousElement: IShape, currentElement: IShape): IShape => {
        const noPreviousElementExists: boolean = previousElement === undefined;
        if (noPreviousElementExists) {
          return currentElement;
        }

        const distancePreviousElement: number = Math.abs(this.selectedFlowNode.y - previousElement.y);
        const distanceCurrentElement: number = Math.abs(this.selectedFlowNode.y - currentElement.y);

        const currentElementIsCloser: boolean = distanceCurrentElement < distancePreviousElement;
        return currentElementIsCloser ? currentElement : previousElement;
      },
    );
  }

  private filterElementsThatOverlapWithSelectedOnYAxis(elementsToFilter: Array<IShape>): Array<IShape> {
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

  private filterElementsThatOverlapWithSelectedOnXAxis(elementsToFilter: Array<IShape>): Array<IShape> {
    return elementsToFilter.filter((element: IShape): boolean => {
      const elementStartsBetweenSelectedElement: boolean =
        element.x >= this.selectedFlowNode.x && element.x <= this.selectedFlowNode.x + this.selectedFlowNode.width;

      const elementEndsBetweenSelectedElement: boolean =
        element.x + element.width >= this.selectedFlowNode.x &&
        element.x + element.width <= this.selectedFlowNode.x + this.selectedFlowNode.width;

      const elementStartsBeforeSelectedAndEndsAfterSelected: boolean =
        this.selectedFlowNode.x > element.x &&
        this.selectedFlowNode.x + this.selectedFlowNode.width < element.x + element.width;

      return (
        elementStartsBetweenSelectedElement ||
        elementEndsBetweenSelectedElement ||
        elementStartsBeforeSelectedAndEndsAfterSelected
      );
    });
  }

  private getElementsAboveTheSelected(): Array<IShape> {
    const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();

    return elementsThatCanHaveAToken.filter((element: IShape): boolean => {
      const elementIsAboveTheSelectedFlowNode: boolean = this.selectedFlowNode.y > element.y + element.height;

      return elementIsAboveTheSelectedFlowNode;
    });
  }

  private getElementsUnderTheSelected(): Array<IShape> {
    const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();

    return elementsThatCanHaveAToken.filter((element: IShape): boolean => {
      const elementIsUnderTheSelectedFlowNode: boolean =
        this.selectedFlowNode.y + this.selectedFlowNode.height < element.y;

      return elementIsUnderTheSelectedFlowNode;
    });
  }

  private getElementsOnTheRightOfTheSelected(): Array<IShape> {
    const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();

    return elementsThatCanHaveAToken.filter((element: IShape): boolean => {
      const elementIsOnTheRightOfTheSelectedFlowNode: boolean = this.selectedFlowNode.x < element.x;

      return elementIsOnTheRightOfTheSelectedFlowNode;
    });
  }

  private getElementsOnTheLeftOfTheSelected(): Array<IShape> {
    const elementsThatCanHaveAToken: Array<IShape> = this.getElementsThatCanHaveAToken();

    return elementsThatCanHaveAToken.filter((element: IShape): boolean => {
      const elementIsOnTheLeftOfTheSelectedFlowNode: boolean = this.selectedFlowNode.x > element.x;

      return elementIsOnTheLeftOfTheSelectedFlowNode;
    });
  }

  private getElementsThatCanHaveAToken(): Array<IShape> {
    return this.elementRegistry.filter((element: IShape) => {
      const elementCanHaveAToken: boolean =
        element.type !== 'bpmn:Participant' &&
        element.type !== 'bpmn:Collaboration' &&
        element.type !== 'bpmn:Lane' &&
        element.type !== 'bpmn:LaneSet' &&
        element.type !== 'label' &&
        element.type !== 'bpmn:TextAnnotation' &&
        element.type !== 'bpmn:SequenceFlow';

      return elementCanHaveAToken;
    });
  }
}
