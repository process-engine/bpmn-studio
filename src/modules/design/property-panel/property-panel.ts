import {bindable, inject} from 'aurelia-framework';

import {IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {
  IBpmnModdle,
  IBpmnModeler,
  IDefinition,
  IDiagramState,
  IElementRegistry,
  IEvent,
  IEventBus,
  IIndextab,
} from '../../../contracts';
import {Extensions} from './indextabs/extensions/extensions';
import {Forms} from './indextabs/forms/forms';
import {General} from './indextabs/general/general';

import {OpenDiagramStateService} from '../../../services/solution-explorer-services/open-diagram-state.service';

@inject('OpenDiagramStateService')
export class PropertyPanel {
  @bindable() public modeler: IBpmnModeler;
  @bindable() public viewer: IBpmnModeler;
  @bindable() public xml: string;
  @bindable() public diagramUri: string;
  @bindable() public isEditable: boolean;
  public elementInPanel: IShape;
  public generalIndextab: IIndextab = new General();
  public formsIndextab: IIndextab = new Forms();
  public extensionsIndextab: IIndextab = new Extensions();
  public indextabs: Array<IIndextab>;

  private moddle: IBpmnModdle;
  private eventBus: IEventBus;
  private openDiagramStateService: OpenDiagramStateService;

  constructor(openDiagramStateService: OpenDiagramStateService) {
    this.openDiagramStateService = openDiagramStateService;
  }

  public attached(): void {
    this.moddle = this.modeler.get('moddle');
    this.eventBus = this.modeler.get('eventBus');

    this.indextabs = [this.generalIndextab, this.formsIndextab, this.extensionsIndextab];

    this.updateIndexTabsSuitability();

    this.eventBus.on(['element.click', 'shape.changed', 'selection.changed'], (event: IEvent) => {
      const elementWasClickedOn: boolean = event.type === 'element.click';
      const elementIsValidShape: boolean = event.type === 'shape.changed' && event.element.type !== 'label';

      const elementIsShapeInPanel: boolean = elementIsValidShape && event.element.id === this.elementInPanel.id;

      if (elementWasClickedOn || elementIsShapeInPanel) {
        this.elementInPanel = event.element;
      }

      const selectedElementChanged: boolean = event.type === 'selection.changed' && event.newSelection.length !== 0;

      if (selectedElementChanged) {
        this.elementInPanel = event.newSelection[0];
      }

      this.updateIndexTabsSuitability();
    });

    setTimeout(() => {
      this.selectPreviouslySelectedOrFirstElement();
    }, 0);
  }

  public xmlWasChanged(): void {
    this.selectPreviouslySelectedOrFirstElement();
  }

  public selectPreviouslySelectedOrFirstElement(): void {
    const diagramState: IDiagramState = this.openDiagramStateService.loadDiagramState(this.diagramUri);

    const noSelectedElementState: boolean =
      diagramState === null ||
      diagramState.metadata.selectedElements === undefined ||
      diagramState.metadata.selectedElements.length === 0;

    if (noSelectedElementState) {
      this.setFirstElement();

      return;
    }

    const selectedElementId: string = diagramState.metadata.selectedElements[0].id;

    this.selectElementById(selectedElementId);
  }

  private setFirstElement(): void {
    let firstElement: IModdleElement;

    this.moddle.fromXML(this.xml, (err: Error, definitions: IDefinition): void => {
      const process: IModdleElement = definitions.rootElements.find((element: IModdleElement) => {
        return element.$type === 'bpmn:Process';
      });

      const processHasFlowElements: boolean = process.flowElements !== undefined && process.flowElements !== null;

      if (processHasFlowElements) {
        firstElement = process.flowElements.find((element: IModdleElement) => {
          return element.$type === 'bpmn:StartEvent';
        });

        if (firstElement === undefined || firstElement === null) {
          firstElement = process.flowElements[0];
        }
      } else if (this.processHasLanes(process)) {
        firstElement = process.laneSets[0].lanes[0];
      }

      if (!firstElement) {
        firstElement = process;
      }

      this.selectElementById(firstElement.id);
    });
  }

  private selectElementById(elementId: string): void {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const element: IShape = elementRegistry.get(elementId);

    if (this.viewer !== undefined) {
      this.viewer.get('selection').select(element);
    } else {
      this.modeler.get('selection').select(element);
    }
  }

  private processHasLanes(process: IModdleElement): boolean {
    const processHasLaneSets: boolean = process.laneSets !== undefined && process.laneSets !== null;
    if (!processHasLaneSets) {
      return false;
    }

    const processHasLanes: boolean = process.laneSets[0].lanes !== undefined && process.laneSets[0].lanes !== null;

    return processHasLanes;
  }

  private updateIndexTabsSuitability(): void {
    for (const indextab of this.indextabs) {
      indextab.canHandleElement = indextab.isSuitableForElement(this.elementInPanel);
    }
  }
}
