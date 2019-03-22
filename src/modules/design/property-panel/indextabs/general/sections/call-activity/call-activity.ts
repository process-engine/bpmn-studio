import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {ICallActivityElement, IShape} from '@process-engine/bpmn-elements_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {GeneralService} from '../../service/general.service';

@inject(GeneralService, Router, EventAggregator)
export class CallActivitySection implements ISection {

  public path: string = '/sections/call-activity/call-activity';
  public canHandleElement: boolean = false;
  public allDiagrams: Array<IDiagram>;
  public selectedDiagramId: string;

  private _businessObjInPanel: ICallActivityElement;
  private _generalService: GeneralService;
  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _activeSolutionUri: string;

  constructor(generalService?: GeneralService, router?: Router, eventAggregator?: EventAggregator) {
    this._generalService = generalService;
    this._router = router;
    this._eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this._activeSolutionUri = this._router.currentInstruction.queryParams.solutionUri;
    this._businessObjInPanel = model.elementInPanel.businessObject;

    await this._getAllDiagrams();

    this.selectedDiagramId = this._businessObjInPanel.calledElement;
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementIsCallActivity: boolean = element !== undefined
                                        && element.businessObject !== undefined
                                        && element.businessObject.$type === 'bpmn:CallActivity';

    return elementIsCallActivity;
  }

  public navigateToCalledDiagram(): void {
    this._router.navigateToRoute('design', {
      diagramName: this.selectedDiagramId,
      solutionUri: this._activeSolutionUri,
      view: 'detail',
    });
  }

  public updateCalledDiagram(): void {
    this._businessObjInPanel.calledElement = this.selectedDiagramId;

    this._publishDiagramChange();
  }

  private async _getAllDiagrams(): Promise<void> {
    const allDiagramsInSolution: Array<IDiagram> = await this._generalService.getAllDiagrams();

    const currentDiagramName: string = this._router.currentInstruction.queryParams.diagramName;
    const allDiagramWithoutCurrentOne: Array<IDiagram> = allDiagramsInSolution.filter((diagram: IDiagram) => {
      return diagram.name !== currentDiagramName;
    });

    this.allDiagrams = allDiagramWithoutCurrentOne;
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }
}
