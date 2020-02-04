import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, InspectPanelTab} from '../../../../../contracts/index';
import environment from '../../../../../environment';

@inject(EventAggregator)
export class InspectPanel {
  @bindable public correlationToSelect: DataModels.Correlations.Correlation;
  @bindable public correlations: Array<DataModels.Correlations.Correlation>;
  @bindable public selectedCorrelation: DataModels.Correlations.Correlation;
  @bindable public processInstanceToSelect: DataModels.Correlations.ProcessInstance;
  @bindable public processInstances: Array<DataModels.Correlations.ProcessInstance>;
  @bindable public selectedProcessInstance: DataModels.Correlations.ProcessInstance;
  @bindable public fullscreen: boolean = false;
  @bindable public activeDiagram: IDiagram;
  @bindable public activeSolutionEntry: ISolutionEntry;
  @bindable public totalCorrelationCount: number;
  @bindable public totalProcessInstanceCount: number;

  public inspectPanelTab: typeof InspectPanelTab = InspectPanelTab;
  public showCorrelationList: boolean = true;
  public showProcessInstanceList: boolean = true;

  public showLogViewer: boolean = false;

  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public attached(): void {
    this.subscriptions = [
      this.eventAggregator.subscribe(environment.events.inspectProcessInstance.showLogViewer, () => {
        this.changeTab(InspectPanelTab.LogViewer);
      }),
      this.eventAggregator.subscribe(environment.events.inspectProcessInstance.showProcessInstanceList, () => {
        this.changeTab(InspectPanelTab.ProcessInstanceList);
      }),
    ];
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;

    this.eventAggregator.publish(environment.events.inspect.shouldDisableTokenViewerButton, this.fullscreen);
  }

  public activeDiagramChanged(): void {
    this.selectedProcessInstance = undefined;
    this.processInstanceToSelect = undefined;
    this.selectedCorrelation = undefined;
    this.correlationToSelect = undefined;

    this.showLogViewer = false;
    this.showCorrelationList = true;
    this.showProcessInstanceList = false;
  }

  public changeTab(inspectPanelTab: InspectPanelTab): void {
    const shouldShowCorrelationList: boolean = inspectPanelTab === InspectPanelTab.CorrelationList;
    const shouldShowProcessInstanceList: boolean = inspectPanelTab === InspectPanelTab.ProcessInstanceList;
    const shouldShowLogViewer: boolean = inspectPanelTab === InspectPanelTab.LogViewer;

    this.showCorrelationList = shouldShowCorrelationList;
    this.showLogViewer = shouldShowLogViewer;
    this.showProcessInstanceList = shouldShowProcessInstanceList;
  }

  public processInstancesChanged(
    newProcessInstance: DataModels.Correlations.ProcessInstance,
    oldProcessInstance: DataModels.Correlations.ProcessInstance,
  ): void {
    const firstProcessInstanceGotSelected: boolean = oldProcessInstance !== undefined;
    const shouldEnableTokenViewerButton: boolean = !(firstProcessInstanceGotSelected || this.fullscreen);

    if (shouldEnableTokenViewerButton) {
      this.eventAggregator.publish(environment.events.inspect.shouldDisableTokenViewerButton, false);
    }
  }
}
