import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, BindingEngine, Disposable inject} from 'aurelia-framework';
import {ValidateEvent, ValidationController, ValidationRules} from 'aurelia-validation';

import {IModdleElement, IPoolElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModeler, IElementRegistry, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(ValidationController, EventAggregator, BindingEngine)
export class PoolSection implements ISection {
  public path: string = '/sections/pool/pool';
  public canHandleElement: boolean = false;
  public validationController: ValidationController;
  public validationError: boolean = false;
  public businessObjInPanel: IPoolElement;
  public processRefId: string;
  @bindable public processIdCheckboxChecked: boolean = false;
  public showModal: boolean = false;
  public showProcessIdWarningModal: boolean = false;

  private modeler: IBpmnModeler;
  private previousProcessRefId: string;
  private eventAggregator: EventAggregator;
  private bindingEngine: BindingEngine;
  private processRefIdObserver: Disposable;

  constructor(controller?: ValidationController, eventAggregator?: EventAggregator, bindingEngine?: BindingEngine) {
    this.validationController = controller;
    this.eventAggregator = eventAggregator;
    this.bindingEngine = bindingEngine;
  }

  public activate(model: IPageModel): void {
    const noProcessReferencePresent: boolean = model.elementInPanel.businessObject.processRef === undefined;
    if (noProcessReferencePresent) {
      return;
    }

    if (this.validationError) {
      this.processRefId = this.previousProcessRefId;
      this.validationController.validate();
    }

    this.businessObjInPanel = model.elementInPanel.businessObject;
    this.processRefId = this.businessObjInPanel.processRef.id;
    this.previousProcessRefId = this.businessObjInPanel.processRef.id;

    this.modeler = model.modeler;

    if (this.processRefIdObserver !== undefined) {
      this.processRefIdObserver.dispose();
      this.processRefIdObserver = undefined;
    }

    this.processRefIdObserver = this.bindingEngine
      .propertyObserver(this.businessObjInPanel.processRef, 'id')
      .subscribe((newId: string) => {
        this.processRefId = newId;
      });

    this.validationController.subscribe((event: ValidateEvent) => {
      this.validateId(event);
    });

    this.setValidationRules();

    this.showProcessIdWarningModal = Boolean(window.localStorage.getItem('showProcessIdWarningModal'));
  }

  public detached(): void {
    if (this.validationError) {
      this.processRefId = this.previousProcessRefId;
      this.validationController.validate();
    }
  }

  public processIdCheckboxCheckedChanged(newValue: boolean): void {
    if (!newValue || this.showProcessIdWarningModal) {
      return;
    }

    this.showModal = true;
  }

  public closeModal(): void {
    this.showModal = false;
    this.persistModalOptionToLocalStorage();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this.elementIsParticipant(element);
  }

  public publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private elementIsParticipant(element: IShape): boolean {
    return (
      element !== undefined &&
      element.businessObject !== undefined &&
      element.businessObject.$type === 'bpmn:Participant'
    );
  }

  private validateId(event: ValidateEvent): void {
    if (event.type !== 'validate') {
      return;
    }
    this.validationError = false;

    for (const result of event.results) {
      if (result.rule.property.displayName !== 'processId') {
        continue;
      }
      if (result.valid === false) {
        this.validationError = true;
        document.getElementById(result.rule.property.displayName).style.border = '2px solid red';
      } else {
        document.getElementById(result.rule.property.displayName).style.border = '';
      }
    }
  }

  public updateId(): void {
    this.validationController.validate();
    if (this.validationController.errors.length > 0) {
      return;
    }

    this.businessObjInPanel.processRef.id = this.processRefId;
    this.publishDiagramChange();
  }

  private formIdIsUnique(id: string): boolean {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const elementsWithSameId: Array<IShape> = elementRegistry.filter((element: IShape) => {
      return element.businessObject.id === this.businessObjInPanel.processRef.id;
    });

    return elementsWithSameId.length === 0;
  }

  private isProcessIdUnique(id: string): boolean {
    // eslint-disable-next-line no-underscore-dangle
    const elementIds: Array<string> = this.modeler._definitions.rootElements.map((rootElement: IModdleElement) => {
      return rootElement.id;
    });

    const currentId: number = elementIds.indexOf(this.businessObjInPanel.processRef.id);
    elementIds.splice(currentId, 1);

    return !elementIds.includes(id);
  }

  private setValidationRules(): void {
    ValidationRules.ensure((poolSection: PoolSection) => poolSection.processRefId)
      .displayName('processId')
      .required()
      .withMessage('Process-ID cannot be blank.')
      .then()
      .satisfies((id: string) => this.formIdIsUnique(id) && this.isProcessIdUnique(id))
      .withMessage('Process-ID already exists.')
      .on(this);
  }

  private persistModalOptionToLocalStorage(): void {
    window.localStorage.setItem('showProcessIdWarningModal', this.showProcessIdWarningModal.toString());
  }
}
