import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IEnumValue,
  IExtensionElement,
  IForm,
  IFormElement,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
} from '../../../../../../../contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {ValidateEvent, ValidationController, ValidationRules} from 'aurelia-validation';
import environment from '../../../../../../../environment';

enum FormfieldTypes {
  string = 'string',
  long = 'long',
  number = 'number',
  boolean = 'boolean',
  date = 'date',
  enum = 'enum',
  custom_type = 'custom type',
}

@inject(ValidationController, EventAggregator)
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
  public FormfieldTypes: typeof FormfieldTypes = FormfieldTypes;
  public customType: string;
  public enumValues: Array<IEnumValue> = [];
  public newEnumValueIds: Array<string> = [];
  public newEnumValueNames: Array<string> = [];
  public booleanDefaultValue: boolean;

  private _bpmnModdle: IBpmnModdle;
  private _modeler: IBpmnModeler;
  private _selectedIndex: number;
  private _formElement: IFormElement;
  private _previousFormId: string;
  private _previousForm: IForm;
  private _eventAggregator: EventAggregator;

  constructor(controller?: ValidationController, eventAggregator?: EventAggregator) {
    this.validationController = controller;
    this._eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject;

    this._modeler = model.modeler;
    this._bpmnModdle = this._modeler.get('moddle');

    this.validationController.subscribe((event: ValidateEvent) => {
      this._validateFormId(event);
    });

    this._init();

    if (this.validationError) {
      this._previousForm.id = this._previousFormId;
      this.validationController.validate();
    }
  }

  public detached(): void {
    this._validateOnDetach();
  }

  public isSuitableForElement(element: IShape): boolean {

    const elementHasNoBusinessObject: boolean = element.businessObject === undefined
                                             || element.businessObject === null;

    if (elementHasNoBusinessObject) {
      return false;
    }

    return element.businessObject.$type === 'bpmn:UserTask';
  }

  public addEnumValue(): void {
    const enumValue: {id: string, value: string} = {
      id: `Value_${this._generateRandomId()}`,
      value: '',
    };
    const bpmnValue: IEnumValue = this._bpmnModdle.create('camunda:Value', enumValue);

    this.enumValues.push(bpmnValue);
    Object.assign(this._formElement.fields[this._selectedIndex].values, this.enumValues);
    this._reloadEnumValues();
    this._publishDiagramChange();
  }

  public removeEnumValue(index: number): void {
    this._formElement.fields[this._selectedIndex].values.splice(index, 1);
    this._reloadEnumValues();
    this._publishDiagramChange();
  }

  public changeEnumValueId(index: number): void {
    this.enumValues[index].id = this.newEnumValueIds[index];
    Object.assign(this._formElement.fields[this._selectedIndex].values, this.enumValues);
    this._publishDiagramChange();
  }

  public changeEnumValueName(index: number): void {
    this.enumValues[index].name = this.newEnumValueNames[index];
    Object.assign(this._formElement.fields[this._selectedIndex].values, this.enumValues);
    this._publishDiagramChange();
  }

  public removeSelectedForm(): void {
    const noFormFieldSelected: boolean = !this.isFormSelected;
    if (noFormFieldSelected) {
      return;
    }

    this._formElement.fields.splice(this._selectedIndex, 1);

    this.isFormSelected = false;
    this.selectedForm = undefined;
    this._selectedIndex = undefined;

    this._reloadForms();
    this._publishDiagramChange();
  }

  public async addForm(): Promise<void> {

    const bpmnFormObject: IForm =  {
      id: `Form_${this._generateRandomId()}`,
      label: '',
      defaultValue: '',
    };
    const bpmnForm: IForm = this._bpmnModdle.create('camunda:FormField', bpmnFormObject);

    if (this._formElement.fields === undefined || this._formElement.fields === null) {
      this._formElement.fields = [];
    }

    this._formElement.fields.push(bpmnForm);
    this.forms.push(bpmnForm);
    this.selectedForm = bpmnForm;

    this.selectForm();
    this._publishDiagramChange();
  }

  public updateId(): void {
    this.validationController.validate();

    const hasValidationErrors: boolean = this.validationController.errors.length > 0;
    if (hasValidationErrors) {
      this._resetId();
    }

    const isSelectedFormIdNotExisting: boolean = this.selectedForm === null || this.selectedForm.id === '';
    if (isSelectedFormIdNotExisting) {
      return;
    }

    this._formElement.fields[this._selectedIndex].id = this.selectedForm.id;
    this._publishDiagramChange();
  }

  public selectForm(): void {
    if (this.validationError) {
      this._previousForm.id = this._previousFormId;
    }

    this._previousFormId = this.selectedForm.id;
    this._previousForm = this.selectedForm;

    this.validationController.validate();

    this.isFormSelected = true;

    const selectedFormHasType: boolean = this.selectedForm.type !== undefined;
    this.selectedType = selectedFormHasType
                    ? this._getTypeAndHandleCustomType(this.selectedForm.type)
                    : null;

    this._selectedIndex = this._getSelectedIndex();

    this._setValidationRules();
    this._reloadEnumValues();
  }

  public updateType(): void {
    /*
     * Evaluates the type of the form field.
     *
     * If the user selected a custom type, find out what type the user provided.
     */
    const type: string = ((): string => {
      const selectedTypeIsNotCustomType: boolean =
        this.selectedType !== FormfieldTypes.custom_type;

      if (selectedTypeIsNotCustomType) {
        return this.selectedType;
      }

      const customTypeIsDefined: boolean = this.customType !== undefined;
      return customTypeIsDefined
                  ? this.customType
                  : '';
    })();

    this._formElement.fields[this._selectedIndex].type = type;
    this._reloadEnumValues();
    this._publishDiagramChange();
  }

  public updateLabel(): void {
    this._formElement.fields[this._selectedIndex].label = this.selectedForm.label;
    this._publishDiagramChange();
  }

  public updateDefaultValue(): void {
    const selectedTypeIsBoolean: boolean = this.selectedType === FormfieldTypes.boolean;
    if (selectedTypeIsBoolean) {
      this._formElement.fields[this._selectedIndex].defaultValue = `${this.booleanDefaultValue}`;
    } else {
      this._formElement.fields[this._selectedIndex].defaultValue = this.selectedForm.defaultValue;
    }

    this._publishDiagramChange();
  }

  private _validateOnDetach(): void {
    if (!this.validationError) {
      return;
    }

    const bpmnFormFieldObject: IForm = {
      id: `Form_${this._generateRandomId()}`,
      label: '',
      defaultValue: '',
    };
    const bpmnForm: IForm = this._bpmnModdle.create('camunda:FormField', bpmnFormFieldObject);

    if (this._formElement.fields === undefined || this._formElement.fields === null) {
      this._formElement.fields = [];
    }

    this._resetIdOnSelectedOrPrevious();

    this.validationController.validate();
    this.updateId();
  }

  private _resetIdOnSelectedOrPrevious(): void {
    if (this.selectedForm !== null) {
      this.selectedForm.id = this._previousFormId;
    } else {
      this._previousForm.id = this._previousFormId;
    }
  }

  private _init(): void {
    this.isFormSelected = false;
    if (this.canHandleElement) {
      this._formElement = this._getOrCreateFormElement();
      this._reloadForms();
    }
  }

  private _resetId(): void {
    this._resetIdOnSelectedOrPrevious();

    this.validationController.validate();
  }

  private _reloadEnumValues(): void {
    const formIsNotEnum: boolean = this.selectedForm.type !== FormfieldTypes.enum;
    const noValuesInEnum: boolean = this.selectedForm.values === undefined
                                 || this.selectedForm.values.length === 0;

    if (formIsNotEnum) {
      return;
    }

    if (noValuesInEnum) {
      this
        ._formElement
        .fields[this._selectedIndex]
        .values = [];
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

  private _reloadForms(): void {
    this.forms = [];

    const noFormFieldsExist: boolean = this._formElement === undefined
                                    || this._formElement === null
                                    || this._formElement.fields === undefined
                                    || this._formElement.fields === null
                                    || this._formElement.fields.length === 0;

    if (noFormFieldsExist) {
      return;
    }

    this.forms = this._formElement.fields.filter((form: IForm) => {
      const formIsFormField: boolean = form.$type === 'camunda:FormField';

      return formIsFormField;
    });
  }

  private _getTypeAndHandleCustomType(type: string): string {
    const typeIsRegularType: boolean = type === FormfieldTypes.string
                                    || type === FormfieldTypes.long
                                    || type === FormfieldTypes.number
                                    || type === FormfieldTypes.boolean
                                    || type === FormfieldTypes.date
                                    || type === FormfieldTypes.enum
                                    || type === FormfieldTypes.custom_type
                                    || type === null;

    if (typeIsRegularType) {
      this.customType = '';
      return type;
    }

    this.customType = type;
    return FormfieldTypes.custom_type;
  }

  private _getSelectedIndex(): number {
    return this._formElement.fields.findIndex((form: IForm) => {
      const formIsSelectedForm: boolean = form.id === this.selectedForm.id;

      return formIsSelectedForm;
    });
  }

  private _getOrCreateFormElement(): IModdleElement {
    const elementHasNoExtensionsElement: boolean = this.businessObjInPanel.extensionElements === undefined
                                                || this.businessObjInPanel.extensionElements === null;

    if (elementHasNoExtensionsElement) {
      this._createExtensionElement();
    }

    const extensionsValues: Array<IModdleElement> = this.businessObjInPanel.extensionElements.values;

    const formElement: IModdleElement = extensionsValues.find((extensionValue: IModdleElement) => {
      const extensionIsValidForm: boolean = extensionValue.$type === 'camunda:FormData';

      return extensionIsValidForm;
    });

    if (formElement === undefined) {
      this._createEmptyFormData();
      return this._getOrCreateFormElement();
    }

    return formElement;
  }

  private _createExtensionElement(): void {
    const values: Array<IFormElement> = [];
    const fields: Array<IForm> = [];
    const formData: IFormElement = this._bpmnModdle.create('camunda:FormData', {fields: fields});
    values.push(formData);

    this.businessObjInPanel.formKey = 'Form Key';
    const extensionElements: IModdleElement = this._bpmnModdle.create('bpmn:ExtensionElements', {values: values});
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private _createEmptyFormData(): void {
    const fields: Array<IModdleElement> = [];
    const extensionFormElement: IModdleElement = this._bpmnModdle.create('camunda:FormData', {fields: fields});
    this.businessObjInPanel.extensionElements.values.push(extensionFormElement);
  }

  private _generateRandomId(): string {
    let randomId: string = '';
    const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    const randomIdLength: number = 8;
    for (let i: number = 0; i < randomIdLength; i++) {
      randomId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return randomId;
  }

  private _validateFormId(event: ValidateEvent): void {
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

  private _hasFormSameIdAsSelected(forms: Array<IForm>): boolean {

    const unselectedFormWithSameId: IForm = forms.find((form: IForm) => {

      const formHasSameIdAsSelectedForm: boolean = form.id === this.selectedForm.id;
      const formIsNotSelectedForm: boolean = form !== this.selectedForm;

      return formHasSameIdAsSelectedForm && formIsNotSelectedForm;
    });

    return unselectedFormWithSameId !== undefined;
  }

  private _getFormDataFromBusinessObject(businessObject: IModdleElement): IFormElement {
    const extensionElement: IExtensionElement = businessObject.extensionElements;
    const hasNoExtensionElements: boolean = extensionElement === undefined;
    if (hasNoExtensionElements) {
      return;
    }

    const extensions: Array<IModdleElement> = extensionElement.values;
    return extensions.find((extension: IModdleElement) => {
      const isFormData: boolean = extension.$type === 'camunda:FormData';

      return isFormData;
    });
  }

  private _getFormsById(id: string): Array<IShape> {
    const elementRegistry: IElementRegistry = this._modeler.get('elementRegistry');

    const formsWithId: Array<IShape> = elementRegistry.filter((element: IShape) => {
      const currentBusinessObject: IModdleElement = element.businessObject;

      const isNoUserTask: boolean = currentBusinessObject.$type !== 'bpmn:UserTask';
      if (isNoUserTask) {
        return false;
      }
      const formData: IFormElement = this._getFormDataFromBusinessObject(currentBusinessObject);
      if (formData === undefined) {
        return false;
      }

      const forms: Array<IForm> = formData.fields;

      return this._hasFormSameIdAsSelected(forms);
    });

    const selectedTypeIsBoolean: boolean = this.selectedType === FormfieldTypes.boolean;
    if (selectedTypeIsBoolean) {
      this.booleanDefaultValue = this.selectedForm.defaultValue === 'true'
                              || this.selectedForm.defaultValue === '1';
    }

    return formsWithId;
  }

  private _formIdIsUnique(id: string): boolean {
    const formsWithSameId: Array<IShape> = this._getFormsById(id);
    const isIdUnique: boolean = formsWithSameId.length === 0;

    return isIdUnique;
  }

  private _setValidationRules(): void {
    ValidationRules
      .ensure((form: IForm) => form.id)
      .displayName('formId')
      .required()
      .withMessage('ID cannot be blank.')
      .then()
      .satisfies((id: string) => this._formIdIsUnique(id))
      .withMessage('ID already exists.')
      .on(this.selectedForm);
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }
}
