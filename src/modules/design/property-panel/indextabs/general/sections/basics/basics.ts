import {EventAggregator} from 'aurelia-event-aggregator';
import {BindingEngine, Disposable, inject} from 'aurelia-framework';
import {ValidateEvent, ValidationController, ValidationRules} from 'aurelia-validation';

import {IEventDefinition, IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IModeling,
  IPageModel,
  ISection,
  SupportedBPMNElementListEntry,
  SupportedBPMNElements,
} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';

@inject(ValidationController, EventAggregator, BindingEngine)
export class BasicsSection implements ISection {
  public path: string = '/sections/basics/basics';
  public canHandleElement: boolean = true;
  public businessObjInPanel: IModdleElement & {eventDefinitions?: Array<IEventDefinition>};
  public businessObjInPanelId: string;
  public elementDocumentation: string;
  public validationError: boolean = false;
  public showModal: boolean = false;
  public elementType: string;
  public showUnsupportedFlag: boolean = false;

  public docsInput: HTMLElement;

  private modeling: IModeling;
  private modeler: IBpmnModeler;
  private bpmnModdle: IBpmnModdle;
  private elementInPanel: IShape;
  private previousProcessRefId: string;
  private validationController: ValidationController;
  private eventAggregator: EventAggregator;
  private bindingEngine: BindingEngine;
  private businessObjInPanelIdObserver: Disposable;

  constructor(controller?: ValidationController, eventAggregator?: EventAggregator, bindingEngine?: BindingEngine) {
    this.validationController = controller;
    this.eventAggregator = eventAggregator;
    this.bindingEngine = bindingEngine;
  }

  public activate(model: IPageModel): void {
    if (this.validationError) {
      this.businessObjInPanelId = this.previousProcessRefId;
      this.validationController.validate();
    }

    this.elementInPanel = model.elementInPanel;
    this.businessObjInPanel = model.elementInPanel.businessObject;
    this.businessObjInPanelId = this.businessObjInPanel.id;
    this.previousProcessRefId = model.elementInPanel.businessObject.id;

    if (this.businessObjInPanelIdObserver !== undefined) {
      this.businessObjInPanelIdObserver.dispose();
      this.businessObjInPanelIdObserver = undefined;
    }

    this.businessObjInPanelIdObserver = this.bindingEngine
      .propertyObserver(this.businessObjInPanel, 'id')
      .subscribe((newId: string) => {
        this.businessObjInPanelId = newId;
      });

    this.modeling = model.modeler.get('modeling');
    this.bpmnModdle = model.modeler.get('moddle');
    this.modeler = model.modeler;

    this.validationController.subscribe((event: ValidateEvent) => {
      this.validateFormId(event);
    });

    this.init();

    this.setValidationRules();
  }

  public attached(): void {
    this.recoverInputHeight();

    this.saveInputHeightOnChange();
  }

  public detached(): void {
    this.docsInput.removeEventListener('mousedown', this.saveInputHeightOnMouseUp);

    if (!this.validationError) {
      return;
    }

    this.businessObjInPanelId = this.previousProcessRefId;
    this.validationController.validate();
  }

  public isSuitableForElement(element: IShape): boolean {
    if (element === undefined || element === null) {
      return false;
    }

    return true;
  }

  public updateDocumentation(): void {
    this.elementInPanel.documentation = [];

    const documentationPropertyObject: object = {text: this.elementDocumentation};
    const documentation: IModdleElement = this.bpmnModdle.create('bpmn:Documentation', documentationPropertyObject);
    this.elementInPanel.documentation.push(documentation);

    const elementInPanelDocumentation: object = {documentation: this.elementInPanel.documentation};
    this.modeling.updateProperties(this.elementInPanel, elementInPanelDocumentation);
    this.publishDiagramChange();
  }

  public updateName(): void {
    this.modeling.updateLabel(this.elementInPanel, this.businessObjInPanel.name);

    this.publishDiagramChange();
  }

  public updateId(): void {
    this.validationController.validate();

    if (this.validationController.errors.length > 0) {
      return;
    }

    const updateProperty: object = {id: this.businessObjInPanelId};
    this.modeling.updateProperties(this.elementInPanel, updateProperty);
    this.publishDiagramChange();
  }

  private init(): void {
    if (!this.businessObjInPanel) {
      return;
    }

    const typeOfSelectedElement: string = this.businessObjInPanel.$type;
    this.elementType = this.humanizeElementType(typeOfSelectedElement);

    this.showUnsupportedFlag = !this.isCurrentBPMNElementSupported();

    const documentationExists: boolean =
      this.businessObjInPanel.documentation !== undefined &&
      this.businessObjInPanel.documentation !== null &&
      this.businessObjInPanel.documentation.length > 0;

    if (documentationExists) {
      this.elementDocumentation = this.businessObjInPanel.documentation[0].text;
    } else {
      this.elementDocumentation = '';
    }
  }

  private isCurrentBPMNElementSupported(): boolean {
    const typeOfSelectedElement: string = this.businessObjInPanel.$type;

    return SupportedBPMNElements.some((supportedBPMNElement: SupportedBPMNElementListEntry) => {
      if (typeOfSelectedElement !== supportedBPMNElement.type) {
        return false;
      }

      const currentElementHasUnsupportedVariable: boolean = supportedBPMNElement.unsupportedVariables.some(
        (unsupportedVariable: string) => {
          return Object.keys(this.elementInPanel.businessObject).includes(unsupportedVariable);
        },
      );

      if (currentElementHasUnsupportedVariable) {
        return false;
      }

      if (this.businessObjInPanel.eventDefinitions === undefined) {
        return supportedBPMNElement.supportedEventDefinitions.some((supportedEventDefinition: string) => {
          return supportedEventDefinition === '';
        });
      }

      const eventDefinition: string = this.businessObjInPanel.eventDefinitions[0].$type;

      return supportedBPMNElement.supportedEventDefinitions.some((supportedEventDefinition: string) => {
        return supportedEventDefinition === eventDefinition;
      });
    });
  }

  private humanizeElementType(type: string): string {
    const rawType: string = type.replace(/^bpmn:/, '');
    const humanizedType: string = rawType.replace(/([a-z])([A-Z])/g, '$1 $2');

    return humanizedType;
  }

  private validateFormId(event: ValidateEvent): void {
    if (event.type !== 'validate') {
      return;
    }

    this.validationError = false;
    for (const result of event.results) {
      if (result.rule.property.displayName !== 'elementId') {
        continue;
      }
      if (result.valid === false) {
        this.validationError = true;
        (document.querySelector('[data-test-property-panel-element-id]') as HTMLInputElement).style.border =
          '2px solid red';
      } else {
        (document.querySelector('[data-test-property-panel-element-id]') as HTMLInputElement).style.border = '';
      }
    }
  }

  private formIdIsUnique(id: string): boolean {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');

    const elementsWithSameId: Array<IShape> = elementRegistry.filter((element: IShape) => {
      const elementIsBusinessObjectInPanel: boolean = element.businessObject === this.businessObjInPanel;
      if (elementIsBusinessObjectInPanel) {
        return false;
      }

      const elementIsOfTypeLabel: boolean = element.type === 'label';
      if (elementIsOfTypeLabel) {
        return false;
      }

      const elementHasSameId: boolean = element.businessObject.id === id;

      return elementHasSameId;
    });

    return elementsWithSameId.length === 0;
  }

  private areRootElementIdsUnique(id: string): boolean {
    // eslint-disable-next-line no-underscore-dangle
    const elementIds: Array<string> = this.modeler._definitions.rootElements.map((rootElement: IModdleElement) => {
      return rootElement.id;
    });

    const currentElementIdIndex = elementIds.indexOf(this.businessObjInPanel.id);
    if (currentElementIdIndex >= 0) {
      elementIds.splice(currentElementIdIndex, 1);
    }

    return !elementIds.includes(id);
  }

  private isDefinitionIdUnique(id: string): boolean {
    // eslint-disable-next-line no-underscore-dangle
    return this.modeler._definitions.id !== id;
  }

  private setValidationRules(): void {
    ValidationRules.ensure((basicsSection: BasicsSection) => basicsSection.businessObjInPanelId)
      .displayName('elementId')
      .required()
      .withMessage('ID cannot be blank.')
      .satisfies((id: string) => !id.includes(' '))
      .withMessage('ID must not contain spaces.')
      .then()
      .satisfies(
        (id: string) => this.formIdIsUnique(id) && this.areRootElementIdsUnique(id) && this.isDefinitionIdUnique(id),
      )
      .withMessage('ID already exists.')
      .on(this);
  }

  private saveInputHeightOnChange(): void {
    this.docsInput.addEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  private recoverInputHeight(): void {
    this.docsInput.style.height = `${localStorage.getItem('docsInputHeight')}px`;
  }

  private saveInputHeightOnMouseUp: EventListenerOrEventListenerObject = () => {
    const resizeListenerFunction: EventListenerOrEventListenerObject = (): void => {
      localStorage.setItem('docsInputHeight', this.docsInput.clientHeight.toString());
      window.removeEventListener('mouseup', resizeListenerFunction);
    };
    window.addEventListener('mouseup', resizeListenerFunction);
  };

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
