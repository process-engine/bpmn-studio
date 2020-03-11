import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {ValidateEvent, ValidationController, ValidationRules} from 'aurelia-validation';

import {
  IEnumValue,
  IExtensionElement,
  IForm,
  IFormElement,
  IModdleElement,
  IShape,
} from '@process-engine/bpmn-elements_contracts';
import {HelpModalService} from '../../../../../../../services/help-modal-service/help-modal-service';

import {
  HelpTextId,
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IPageModel,
  ISection,
} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';

enum FormfieldTypes {
  string = 'string',
  long = 'long',
  number = 'number',
  boolean = 'boolean',
  date = 'date',
  enum = 'enum',
  customType = 'custom type',
}

@inject(ValidationController, EventAggregator, HelpModalService)
export class BasicsSection implements ISection {
  public path: string = '/sections/basics/basics';
  public canHandleElement: boolean = true;
  public validationError: boolean = false;
  public validationController: ValidationController;
  public isFormSelected: boolean = false;
  public businessObjInPanel: IFormElement;
  public forms: Array<IForm>;
  public selectedForm: IForm;
  public selectedType: string;
  // eslint-disable-next-line @typescript-eslint/member-naming
  public FormfieldTypes: typeof FormfieldTypes = FormfieldTypes;
  public customType: string;
  public enumValues: Array<IEnumValue> = [];
  public newEnumValueIds: Array<string> = [];
  public newEnumValueNames: Array<string> = [];
  public booleanDefaultValue: boolean;
  public booleanDefaultValueString: string;

  private bpmnModdle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private selectedIndex: number;
  private formElement: IFormElement;
  private previousFormId: string;
  private previousForm: IForm;
  private eventAggregator: EventAggregator;
  private helpModalService: HelpModalService;

  constructor(
    controller?: ValidationController,
    eventAggregator?: EventAggregator,
    helpModalService?: HelpModalService,
  ) {
    this.validationController = controller;
    this.eventAggregator = eventAggregator;
    this.helpModalService = helpModalService;
  }

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject;

    this.modeler = model.modeler;
    this.bpmnModdle = this.modeler.get('moddle');

    this.validationController.subscribe((event: ValidateEvent) => {
      this.validateFormId(event);
    });

    this.init();

    if (this.validationError) {
      this.previousForm.id = this.previousFormId;
      this.validationController.validate();
    }
  }

  public detached(): void {
    this.validateOnDetach();
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element.businessObject === undefined || element.businessObject === null;

    if (elementHasNoBusinessObject) {
      return false;
    }

    return element.businessObject.$type === 'bpmn:UserTask';
  }

  public addEnumValue(): void {
    const enumValue: {id: string; value: string} = {
      id: `Value_${this.generateRandomId()}`,
      value: '',
    };
    const bpmnValue: IEnumValue = this.bpmnModdle.create('camunda:Value', enumValue);

    this.enumValues.push(bpmnValue);
    Object.assign(this.formElement.fields[this.selectedIndex].values, this.enumValues);
    this.reloadEnumValues();
    this.publishDiagramChange();
  }

  public removeEnumValue(index: number): void {
    this.formElement.fields[this.selectedIndex].values.splice(index, 1);
    this.reloadEnumValues();
    this.publishDiagramChange();
  }

  public changeEnumValueId(index: number): void {
    this.enumValues[index].id = this.newEnumValueIds[index];
    Object.assign(this.formElement.fields[this.selectedIndex].values, this.enumValues);
    this.publishDiagramChange();
  }

  public changeEnumValueName(index: number): void {
    this.enumValues[index].name = this.newEnumValueNames[index];
    Object.assign(this.formElement.fields[this.selectedIndex].values, this.enumValues);
    this.publishDiagramChange();
  }

  public removeSelectedForm(): void {
    const noFormFieldSelected: boolean = !this.isFormSelected;
    if (noFormFieldSelected) {
      return;
    }

    this.formElement.fields.splice(this.selectedIndex, 1);

    this.isFormSelected = false;
    this.selectedForm = undefined;
    this.selectedIndex = undefined;

    this.reloadForms();
    this.publishDiagramChange();
  }

  public async addForm(): Promise<void> {
    const bpmnFormObject: IForm = {
      id: `Form_${this.generateRandomId()}`,
      label: '',
      defaultValue: '',
    };
    const bpmnForm: IForm = this.bpmnModdle.create('camunda:FormField', bpmnFormObject);

    if (this.formElement.fields === undefined || this.formElement.fields === null) {
      this.formElement.fields = [];
    }

    this.formElement.fields.push(bpmnForm);
    this.forms.push(bpmnForm);
    this.selectedForm = bpmnForm;

    this.selectForm();
    this.publishDiagramChange();
  }

  public updateId(): void {
    this.validationController.validate();

    const hasValidationErrors: boolean = this.validationController.errors.length > 0;
    if (hasValidationErrors) {
      this.resetId();
    }

    const isSelectedFormIdNotExisting: boolean = this.selectedForm === null || this.selectedForm.id === '';
    if (isSelectedFormIdNotExisting) {
      return;
    }

    this.formElement.fields[this.selectedIndex].id = this.selectedForm.id;
    this.publishDiagramChange();
  }

  public selectForm(): void {
    if (this.validationError) {
      this.previousForm.id = this.previousFormId;
    }

    this.previousFormId = this.selectedForm.id;
    this.previousForm = this.selectedForm;

    this.validationController.validate();

    this.isFormSelected = true;

    const selectedFormHasType: boolean = this.selectedForm.type !== undefined;
    this.selectedType = selectedFormHasType ? this.getTypeAndHandleCustomType(this.selectedForm.type) : null;

    this.selectedIndex = this.getSelectedIndex();

    this.setValidationRules();
    this.reloadEnumValues();
  }

  public updateType(): void {
    /*
     * Evaluates the type of the form field.
     *
     * If the user selected a custom type, find out what type the user provided.
     */
    const type: string = ((): string => {
      const selectedTypeIsNotCustomType: boolean = this.selectedType !== FormfieldTypes.customType;

      if (selectedTypeIsNotCustomType) {
        return this.selectedType;
      }

      const customTypeIsDefined: boolean = this.customType !== undefined;
      return customTypeIsDefined ? this.customType : '';
    })();

    this.formElement.fields[this.selectedIndex].type = type;
    this.reloadEnumValues();
    this.publishDiagramChange();
  }

  public updateLabel(): void {
    this.formElement.fields[this.selectedIndex].label = this.selectedForm.label;
    this.publishDiagramChange();
  }

  public updateBooleanDefaultValue(): void {
    this.booleanDefaultValueString = this.booleanDefaultValue.toString();

    this.updateDefaultValue();
  }

  public updateBooleanDefaultValueString(): void {
    this.booleanDefaultValue = this.booleanDefaultValueString === 'true' || this.booleanDefaultValueString === '1';

    this.updateDefaultValue();
  }

  public updateDefaultValue(): void {
    const selectedTypeIsBoolean: boolean = this.selectedType === FormfieldTypes.boolean;
    if (selectedTypeIsBoolean) {
      this.formElement.fields[this.selectedIndex].defaultValue = `${this.booleanDefaultValueString}`;
    } else {
      this.formElement.fields[this.selectedIndex].defaultValue = this.selectedForm.defaultValue;
    }

    this.publishDiagramChange();
  }

  public showUserTaskHelpModal(): void {
    this.helpModalService.showHelpModal(HelpTextId.UserTaskUsage);
  }

  private validateOnDetach(): void {
    if (!this.validationError) {
      return;
    }

    const bpmnFormFieldObject: IForm = {
      id: `Form_${this.generateRandomId()}`,
      label: '',
      defaultValue: '',
    };
    this.bpmnModdle.create('camunda:FormField', bpmnFormFieldObject);

    if (this.formElement.fields === undefined || this.formElement.fields === null) {
      this.formElement.fields = [];
    }

    this.resetIdOnSelectedOrPrevious();

    this.validationController.validate();
    this.updateId();
  }

  private resetIdOnSelectedOrPrevious(): void {
    if (this.selectedForm !== null) {
      this.selectedForm.id = this.previousFormId;
    } else {
      this.previousForm.id = this.previousFormId;
    }
  }

  private init(): void {
    this.isFormSelected = false;
    if (this.canHandleElement) {
      this.formElement = this.getOrCreateFormElement();
      this.reloadForms();
    }
  }

  private resetId(): void {
    this.resetIdOnSelectedOrPrevious();

    this.validationController.validate();
  }

  private reloadEnumValues(): void {
    const formIsNotEnum: boolean = this.selectedForm.type !== FormfieldTypes.enum;
    const noValuesInEnum: boolean = this.selectedForm.values === undefined || this.selectedForm.values.length === 0;

    if (formIsNotEnum) {
      return;
    }

    if (noValuesInEnum) {
      this.formElement.fields[this.selectedIndex].values = [];
    }

    /*
     * Prepare new form fields.
     */
    const enumValues: Array<IEnumValue> = [];
    const newEnumValueIds: Array<string> = [];
    const newEnumValueNames: Array<string> = [];

    for (const value of this.selectedForm.values) {
      const camundaValue: boolean = value.$type !== 'camunda:Value';
      if (camundaValue) {
        continue;
      }

      enumValues.push(value);
      newEnumValueIds.push(value.id);
      newEnumValueNames.push(value.name);
    }

    /*
     * Assign new form fields values.
     */
    this.enumValues = enumValues;
    this.newEnumValueIds = newEnumValueIds;
    this.newEnumValueNames = newEnumValueNames;
  }

  private reloadForms(): void {
    this.forms = [];

    const noFormFieldsExist: boolean =
      this.formElement === undefined ||
      this.formElement === null ||
      this.formElement.fields === undefined ||
      this.formElement.fields === null ||
      this.formElement.fields.length === 0;

    if (noFormFieldsExist) {
      return;
    }

    this.forms = this.formElement.fields.filter((form: IForm) => {
      const formIsFormField: boolean = form.$type === 'camunda:FormField';

      return formIsFormField;
    });
  }

  private getTypeAndHandleCustomType(type: string): string {
    const typeIsRegularType: boolean =
      type === FormfieldTypes.string ||
      type === FormfieldTypes.long ||
      type === FormfieldTypes.number ||
      type === FormfieldTypes.boolean ||
      type === FormfieldTypes.date ||
      type === FormfieldTypes.enum ||
      type === FormfieldTypes.customType ||
      type === null;

    if (typeIsRegularType) {
      this.customType = '';
      return type;
    }

    this.customType = type;
    return FormfieldTypes.customType;
  }

  private getSelectedIndex(): number {
    return this.formElement.fields.findIndex((form: IForm) => {
      const formIsSelectedForm: boolean = form.id === this.selectedForm.id;

      return formIsSelectedForm;
    });
  }

  private getOrCreateFormElement(): IModdleElement {
    const elementHasNoExtensionsElement: boolean =
      this.businessObjInPanel.extensionElements === undefined || this.businessObjInPanel.extensionElements === null;

    if (elementHasNoExtensionsElement) {
      this.createExtensionElement();
    }

    const extensionsValues: Array<IModdleElement> = this.businessObjInPanel.extensionElements.values;

    const formElement: IModdleElement = extensionsValues.find((extensionValue: IModdleElement) => {
      const extensionIsValidForm: boolean = extensionValue.$type === 'camunda:FormData';

      return extensionIsValidForm;
    });

    if (formElement === undefined) {
      this.createEmptyFormData();
      return this.getOrCreateFormElement();
    }

    return formElement;
  }

  private createExtensionElement(): void {
    const values: Array<IFormElement> = [];
    const fields: Array<IForm> = [];
    const formData: IFormElement = this.bpmnModdle.create('camunda:FormData', {fields: fields});
    values.push(formData);

    this.businessObjInPanel.formKey = 'Form Key';
    const extensionElements: IModdleElement = this.bpmnModdle.create('bpmn:ExtensionElements', {values: values});
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private createEmptyFormData(): void {
    const fields: Array<IModdleElement> = [];
    const extensionFormElement: IModdleElement = this.bpmnModdle.create('camunda:FormData', {fields: fields});
    this.businessObjInPanel.extensionElements.values.push(extensionFormElement);
  }

  private generateRandomId(): string {
    let randomId: string = '';
    const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    const randomIdLength: number = 8;
    for (let i: number = 0; i < randomIdLength; i++) {
      randomId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return randomId;
  }

  private validateFormId(event: ValidateEvent): void {
    if (event.type !== 'validate') {
      return;
    }

    this.validationError = false;
    for (const result of event.results) {
      if (result.rule.property.displayName !== 'formId') {
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

  private hasFormSameIdAsSelected(forms: Array<IForm>): boolean {
    const unselectedFormWithSameId: IForm = forms.find((form: IForm) => {
      const formHasSameIdAsSelectedForm: boolean = form.id === this.selectedForm.id;
      const formIsNotSelectedForm: boolean = form !== this.selectedForm;

      return formHasSameIdAsSelectedForm && formIsNotSelectedForm;
    });

    return unselectedFormWithSameId !== undefined;
  }

  private getFormDataFromBusinessObject(businessObject: IModdleElement): IFormElement {
    const extensionElement: IExtensionElement = businessObject.extensionElements;
    const hasNoExtensionElements: boolean = extensionElement === undefined;
    if (hasNoExtensionElements) {
      return undefined;
    }

    const extensions: Array<IModdleElement> = extensionElement.values;
    return extensions.find((extension: IModdleElement) => {
      const isFormData: boolean = extension.$type === 'camunda:FormData';

      return isFormData;
    });
  }

  private getFormsById(id: string): Array<IShape> {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');

    const formsWithId: Array<IShape> = elementRegistry.filter((element: IShape) => {
      const currentBusinessObject: IModdleElement = element.businessObject;

      const isNoUserTask: boolean = currentBusinessObject.$type !== 'bpmn:UserTask';
      if (isNoUserTask) {
        return false;
      }

      const formData: IFormElement = this.getFormDataFromBusinessObject(currentBusinessObject);
      if (formData === undefined || formData.fields === undefined) {
        return false;
      }

      const forms: Array<IForm> = formData.fields;

      return this.hasFormSameIdAsSelected(forms);
    });

    const selectedTypeIsBoolean: boolean = this.selectedType === FormfieldTypes.boolean;
    if (selectedTypeIsBoolean) {
      this.booleanDefaultValueString = this.selectedForm.defaultValue;
      this.booleanDefaultValue = this.booleanDefaultValueString === 'true' || this.booleanDefaultValueString === '1';
    }

    return formsWithId;
  }

  private formIdIsUnique(id: string): boolean {
    const formsWithSameId: Array<IShape> = this.getFormsById(id);
    const isIdUnique: boolean = formsWithSameId.length === 0;

    return isIdUnique;
  }

  private setValidationRules(): void {
    ValidationRules.ensure((form: IForm) => form.id)
      .displayName('formId')
      .required()
      .withMessage('ID cannot be blank.')
      .then()
      .satisfies((id: string) => this.formIdIsUnique(id))
      .withMessage('ID already exists.')
      .on(this.selectedForm);
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
