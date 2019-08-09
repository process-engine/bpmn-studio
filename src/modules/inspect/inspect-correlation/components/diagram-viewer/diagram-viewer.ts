import {bindable, inject} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  ICanvas,
  IColorPickerColor,
  IDiagramExportService,
  IElementRegistry,
  IEvent,
  IModeling,
  ISolutionEntry,
  NotificationType,
  defaultBpmnColors,
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
  private diagramModeler: IBpmnModeler;
  private diagramViewer: IBpmnModeler;
  private modeling: IModeling;
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
    this.diagramModeler = new bundle.modeler();
    // eslint-disable-next-line 6river/new-cap
    this.diagramViewer = new bundle.viewer({
      additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule],
    });

    this.modeling = this.diagramModeler.get('modeling');
    this.elementRegistry = this.diagramModeler.get('elementRegistry');

    this.diagramViewer.attachTo(this.canvasModel);

    this.diagramViewer.on('element.click', async (event: IEvent) => {
      await this.colorizeSelection(event.element);

      this.selectedFlowNode = event.element;
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
  }

  public selectFlowNode(flowNodeId: string): void {
    if (this.processInstance === undefined) {
      this.flowNodeToSetAfterProcessInstanceIsSet = flowNodeId;

      return;
    }

    const elementRegistry: IElementRegistry = this.diagramViewer.get('elementRegistry');
    const element: IShape = elementRegistry.get(flowNodeId);

    this.diagramViewer.get('selection').select(element);

    this.selectedFlowNode = element;
    this.colorizeSelection(element);
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

    await this.importXml(this.diagramModeler, this.xmlWithColorizedProgress);
    await this.importXml(this.diagramViewer, this.xmlWithColorizedProgress);
    this.uncoloredSVG = await this.getSVG();

    const elementSelected: boolean = this.selectedFlowNode !== undefined;
    if (elementSelected) {
      const elementsToColorize: Array<IShape> = this.elementRegistry.filter((element: IShape) => {
        const isSelectedElement: boolean = element.id === this.selectedFlowNode.id;

        return isSelectedElement;
      });

      const correlationHasSameElementAsPreviouslySelected: boolean = elementsToColorize.length > 0;
      if (correlationHasSameElementAsPreviouslySelected) {
        this.colorizeSelection(this.selectedFlowNode);

        const colorizedXml: string = await this.getXmlFromModeler();
        await this.importXml(this.diagramViewer, colorizedXml);

        return;
      }
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

  private fitDiagramToViewport(): void {
    const canvas: ICanvas = this.diagramViewer.get('canvas');
    canvas.zoom('fit-viewport', 'auto');
  }

  private async colorizeSelection(selectedElement: IShape): Promise<void> {
    await this.importXml(this.diagramModeler, this.xmlWithColorizedProgress);

    const elementToColorize: IShape = this.elementRegistry.filter((element: IShape): boolean => {
      const isSelectedElement: boolean = element.id === selectedElement.id;

      return isSelectedElement;
    })[0];

    this.colorElement(elementToColorize, defaultBpmnColors.grey);

    const colorizedXml: string = await this.getXmlFromModeler();
    this.importXml(this.diagramViewer, colorizedXml);
  }

  private colorElement(element: IShape, color: IColorPickerColor): void {
    this.modeling.setColor(element, {
      stroke: color.border,
      fill: color.fill,
    });
  }

  private async importXml(modeler: IBpmnModeler, xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;

    if (xmlIsNotLoaded) {
      const notificationMessage: string =
        'The xml could not be loaded. Please try to reopen the Inspect Correlation View.';
      this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return undefined;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      modeler.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }

        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async getXmlFromModeler(): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      const xmlSaveOptions: IBpmnXmlSaveOptions = {
        format: true,
      };

      this.diagramModeler.saveXML(xmlSaveOptions, async (saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
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
