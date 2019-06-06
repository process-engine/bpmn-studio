import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IEventFunction, ISolutionEntry} from '../../../contracts/index';
import environment from '../../../environment';
import {IInspectCorrelationService} from './contracts';

@inject('InspectCorrelationService', EventAggregator)
export class InspectCorrelation {
  @bindable public activeDiagram: IDiagram;
  @bindable public activeSolutionEntry: ISolutionEntry;
  @bindable public selectedProcessInstance: DataModels.Correlations.CorrelationProcessInstance;
  @bindable public selectedCorrelation: DataModels.Correlations.Correlation;
  @bindable public inspectPanelFullscreen: boolean = false;
  @observable public bottomPanelHeight: number = 250;
  @observable public tokenViewerWidth: number = 250;

  public correlations: Array<DataModels.Correlations.Correlation>;
  public token: string;
  public showInspectPanel: boolean = true;
  public showTokenViewer: boolean = false;
  public bottomPanelResizeDiv: HTMLDivElement;
  public rightPanelResizeDiv: HTMLDivElement;
  public selectedFlowNode: IShape;

  public viewIsAttached: boolean = false;

  private _inspectCorrelationService: IInspectCorrelationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;

  constructor(inspectCorrelationService: IInspectCorrelationService,
              eventAggregator: EventAggregator) {

    this._inspectCorrelationService = inspectCorrelationService;
    this._eventAggregator = eventAggregator;
  }

  public async attached(): Promise<void> {
    this.correlations = await this._inspectCorrelationService
                                  .getAllCorrelationsForProcessModelId(this.activeDiagram.id, this.activeSolutionEntry.identity);

    this._eventAggregator.publish(environment.events.statusBar.showInspectCorrelationButtons, true);

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.inspectCorrelation.showInspectPanel, (showInspectPanel: boolean) => {
        this.showInspectPanel = showInspectPanel;
      }),
      this._eventAggregator.subscribe(environment.events.inspectCorrelation.showTokenViewer, (showTokenViewer: boolean) => {
        this.showTokenViewer = showTokenViewer;
      }),
    ];

    this.bottomPanelResizeDiv.addEventListener('mousedown', (mouseDownEvent: Event) => {
      const windowEvent: Event = mouseDownEvent || window.event;
      windowEvent.cancelBubble = true;

      const mousemoveFunction: IEventFunction = (mouseMoveEvent: MouseEvent): void => {
        this._resizeInspectPanel(mouseMoveEvent);
        document.getSelection().empty();
      };

      const mouseUpFunction: IEventFunction = (): void => {
        document.removeEventListener('mousemove', mousemoveFunction);
        document.removeEventListener('mouseup', mouseUpFunction);
      };

      document.addEventListener('mousemove', mousemoveFunction);
      document.addEventListener('mouseup', mouseUpFunction);
    });

    this.rightPanelResizeDiv.addEventListener('mousedown', (mouseDownEvent: Event) => {
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

    this.viewIsAttached = true;
  }

  public detached(): void {
    this._eventAggregator.publish(environment.events.statusBar.showInspectCorrelationButtons, false);

    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  public async activeDiagramChanged(): Promise<void> {
    if (this.viewIsAttached) {
      this.correlations = await this._inspectCorrelationService
                                    .getAllCorrelationsForProcessModelId(this.activeDiagram.id, this.activeSolutionEntry.identity);
    }
  }

  private _resizeInspectPanel(mouseEvent: MouseEvent): void {
    const mouseYPosition: number = mouseEvent.clientY;

    const menuBarHeight: number = 40;
    const inspectCorrelation: HTMLElement = this.bottomPanelResizeDiv.parentElement.parentElement;
    const inspectPanelHeightWithStatusBar: number = inspectCorrelation.clientHeight + menuBarHeight;

    const minInspectPanelHeight: number = 250;

    const newBottomPanelHeight: number = inspectPanelHeightWithStatusBar - mouseYPosition;

    this.bottomPanelHeight = Math.max(newBottomPanelHeight, minInspectPanelHeight);
  }

  private _resizeTokenViewer(mouseEvent: MouseEvent): void {
    const mouseXPosition: number = mouseEvent.clientX;

    const inspectCorrelation: HTMLElement = this.bottomPanelResizeDiv.parentElement.parentElement;
    const minSpaceForDiagramViewer: number = 300;

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
