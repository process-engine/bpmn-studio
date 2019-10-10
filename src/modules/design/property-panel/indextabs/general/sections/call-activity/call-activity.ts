import {EventAggregator} from 'aurelia-event-aggregator';
import {inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {
  ICallActivityElement,
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IShape,
} from '@process-engine/bpmn-elements_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IBpmnModdle, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {GeneralService} from '../../service/general.service';

@inject(GeneralService, Router, EventAggregator)
export class CallActivitySection implements ISection {
  public path: string = '/sections/call-activity/call-activity';
  public canHandleElement: boolean = false;
  public allDiagrams: Array<IDiagram>;
  public startEvents: Array<IShape>;
  public selectValue: string;
  @observable public selectedStartEvent: string;
  public selectedDiagramName: string;

  public previouslySelectedDiagram: string;

  private businessObjInPanel: ICallActivityElement;
  private generalService: GeneralService;
  private router: Router;
  private eventAggregator: EventAggregator;
  private activeSolutionUri: string;
  private moddle: IBpmnModdle;

  constructor(generalService?: GeneralService, router?: Router, eventAggregator?: EventAggregator) {
    this.generalService = generalService;
    this.router = router;
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this.moddle = model.modeler.get('moddle');
    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;
    this.businessObjInPanel = model.elementInPanel.businessObject;

    console.log(this.businessObjInPanel);
    await this.getAllDiagrams();

    this.previouslySelectedDiagram = this.businessObjInPanel.calledElement;
    this.selectedDiagramName = this.businessObjInPanel.calledElement;
    this.selectValue = this.selectedDiagramName;

    if (this.selectValue) {
      this.startEvents = await this.generalService.getAllStartEventsForDiagram(this.selectValue);

      const previousSelectedStartEvent = this.getSelectedStartEvent();

      this.selectedStartEvent = previousSelectedStartEvent || this.startEvents[0].id;
    }
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementIsCallActivity: boolean =
      element !== undefined &&
      element.businessObject !== undefined &&
      element.businessObject.$type === 'bpmn:CallActivity';

    return elementIsCallActivity;
  }

  public navigateToCalledDiagram(): void {
    this.router.navigateToRoute('design', {
      diagramName: this.selectedDiagramName,
      solutionUri: this.activeSolutionUri,
      view: 'detail',
    });
  }

  public isPartOfAllDiagrams(diagramName: string): boolean {
    return this.allDiagrams.some((diagram: IDiagram): boolean => {
      return diagram.name === diagramName;
    });
  }

  public selectedStartEventChanged(newValue, oldValue): void {
    console.log(newValue, oldValue);

    if (newValue === undefined) {
      delete this.businessObjInPanel.extensionElements;
      console.log(this.businessObjInPanel);

      return;
    }

    const noExtensionsElements =
      this.businessObjInPanel.extensionElements === undefined ||
      this.businessObjInPanel.extensionElements.values === undefined ||
      this.businessObjInPanel.extensionElements.values.length === 0;

    if (noExtensionsElements) {
      this.createExtensionElement();
    }

    const bpmnPropertyProperties: object = {
      name: 'startEventId',
      value: newValue,
    };
    const bpmnProperty: IProperty = this.moddle.create('camunda:Property', bpmnPropertyProperties);

    const propertiesElement = this.getPropertiesElement();

    const startEventProperty = propertiesElement.values.findIndex((value: IProperty) => value.name === 'startEventId');

    if (startEventProperty >= 0) {
      propertiesElement.values.splice(startEventProperty, 1);
    }

    propertiesElement.values.push(bpmnProperty);

    console.log(this.businessObjInPanel);
    this.publishDiagramChange();
  }

  public async updateCalledDiagram(): Promise<void> {
    const diagramSelectedViaSelect: boolean = this.selectValue !== undefined;
    if (diagramSelectedViaSelect) {
      this.selectedDiagramName = this.selectValue;
      this.selectValue = undefined;
      this.startEvents = await this.generalService.getAllStartEventsForDiagram(this.selectedDiagramName);
    }

    this.businessObjInPanel.calledElement = this.selectedDiagramName;

    this.publishDiagramChange();
  }

  private getPropertiesElement(): IPropertiesElement {
    const propertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        if (!extensionValue) {
          return undefined;
        }

        const extensionIsPropertiesElement: boolean =
          extensionValue.$type === 'camunda:Properties' &&
          extensionValue.values !== undefined &&
          extensionValue.values !== null;

        return extensionIsPropertiesElement;
      },
    );

    return propertiesElement;
  }

  private createExtensionElement(): void {
    const extensionValues: Array<IModdleElement> = [];
    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});
    extensionValues.push(propertiesElement);

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private getSelectedStartEvent(): string | undefined {
    const extensionElementAndPropertiesExist =
      this.businessObjInPanel.extensionElements !== undefined &&
      this.businessObjInPanel.extensionElements.values !== undefined &&
      this.businessObjInPanel.extensionElements.values.length !== 0;

    if (!extensionElementAndPropertiesExist) {
      return undefined;
    }

    const propertiesElement = this.getPropertiesElement();

    return propertiesElement.values.find((value: IPropertiesElement) => value.name === 'startEventId').value;
  }

  private async getAllDiagrams(): Promise<void> {
    const allDiagramsInSolution: Array<IDiagram> = await this.generalService.getAllDiagrams();

    const currentDiagramName: string = this.router.currentInstruction.params.diagramName;
    const allDiagramWithoutCurrentOne: Array<IDiagram> = allDiagramsInSolution.filter((diagram: IDiagram) => {
      return diagram.name !== currentDiagramName;
    });

    this.allDiagrams = allDiagramWithoutCurrentOne;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
