import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {
  bindable,
  computedFrom,
  inject,
  NewInstance,
} from 'aurelia-framework';
import {PipelineResult, Router} from 'aurelia-router';
import {
  ControllerValidateResult,
  FluentRuleCustomizer,
  ValidateResult,
  ValidationController,
  ValidationRules,
} from 'aurelia-validation';

import {ForbiddenError, isError, UnauthorizedError} from '@essential-projects/errors_ts';
import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {IDiagramCreationService} from '../../../contracts';
import {NotificationType} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../notification/notification.service';
import {SingleDiagramsSolutionExplorerService} from '../../solution-explorer-services/SingleDiagramsSolutionExplorerService';

const ENTER_KEY: string = 'Enter';
const ESCAPE_KEY: string = 'Escape';

interface DiagramCreationState {
  isCreateDiagramInputShown: boolean;
  currentDiagramInputValue: string;
}

@inject(
  Router,
  EventAggregator,
  NewInstance.of(ValidationController),
  'DiagramCreationService',
  'NotificationService',
)
export class SolutionExplorerSolution {

  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _validationController: ValidationController;
  private _diagramCreationService: IDiagramCreationService;
  private _notificationService: NotificationService;

  private _diagramRoute: string = 'processdef-detail';
  private _inspectView: string;
  private _subscriptions: Array<Subscription>;
  private _openedSolution: ISolution;
  private _diagramCreationState: DiagramCreationState = {
    currentDiagramInputValue: undefined,
    isCreateDiagramInputShown: false,
  };
  private _refreshIntervalTask: any;
  private _diagramNameValidator: FluentRuleCustomizer<DiagramCreationState, DiagramCreationState> = ValidationRules
      .ensure((state: DiagramCreationState) => state.currentDiagramInputValue)
      .required()
      .withMessage('Diagram name cannot be blank.')
      .matches(/^[a-z0-9._ \-äöüß]+$/i)
      .withMessage('The diagram name did not pass the input validation. Please consult the manual for valid names.')
      .then()
      .satisfies(async(input: string) => {
        // The solution may have changed on the file system.
        await this.updateSolution();

        const diagramUri: string = `${this._openedSolution.uri}/${input}.bpmn`;
        const diagramWithIdDoesNotExists: boolean = this.
          _findURIObject(this._openedSolution.diagrams, diagramUri) === undefined;

        return diagramWithIdDoesNotExists;
      })
      .withMessage('A diagram with that name already exists.');

  // Fields below are bound from the html view.
  @bindable
  public solutionService: ISolutionExplorerService;
  @bindable
  public solutionIsSingleDiagrams: boolean;
  public createNewDiagramInput: HTMLInputElement;

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    validationController: ValidationController,
    diagramCreationService: IDiagramCreationService,
    notificationService: NotificationService,
  ) {
    this._router = router;
    this._eventAggregator = eventAggregator;
    this._validationController = validationController;
    this._diagramCreationService = diagramCreationService;
    this._notificationService = notificationService;
  }

  public attached(): void {
    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.processSolutionPanel.navigateToHeatmap, (heatmapView?: string) => {
        const heatmapViewIsDashboard: boolean = heatmapView === 'dashboard';

        this._diagramRoute = 'inspect';
        this._inspectView = heatmapViewIsDashboard ? 'dashboard' : 'heatmap';
      }),

      this._eventAggregator.subscribe(environment.events.processSolutionPanel.navigateToDesigner, () => {
        this._diagramRoute = 'processdef-detail';
      }),
    ];

    this._refreshIntervalTask = setInterval(async() =>  {
      this.updateSolution();
    }, environment.processengine.processModelPollingIntervalInMs);
  }

  public detached(): void {
    clearInterval(this._refreshIntervalTask);
    this._disposeSubscriptions();
  }

  /**
   * Called by aurelia, if the value of the solutionService binding changes.
   */
  public solutionServiceChanged(newValue: ISolutionExplorerService, oldValue: ISolutionExplorerService): Promise<void> {
    return this.updateSolution();
  }

  /**
   * Reload the solution by requesting it from the solution service.
   */
  public async updateSolution(): Promise<void> {
    try {
      this._openedSolution = await this.solutionService.loadSolution();
    } catch (error) {
      // In the future we can maybe display a small icon indicating the error.
      if (isError(error, UnauthorizedError)) {
        this._notificationService.showNotification(NotificationType.ERROR, 'You need to login to list process models.');
      } else if (isError(error, ForbiddenError)) {
        this._notificationService.showNotification(NotificationType.ERROR, 'You don\'t have the required permissions to list process models.');
      }
    }
  }

  /*
   * Used when this is a single diagram solution explorer service.
   */
  public async closeDiagram(diagram: IDiagram): Promise<void> {
    const singleDiagramService: SingleDiagramsSolutionExplorerService = this.solutionService as SingleDiagramsSolutionExplorerService;
    singleDiagramService.closeSingleDiagram(diagram);
  }

  /*
   * Called by the parent component to start the creation dialog of a new
   * diagram.
   */
  public async startCreationOfNewDiagram(): Promise<void> {
    if (this._diagramCreationState.isCreateDiagramInputShown) {
      return;
    }

    this._diagramCreationState.isCreateDiagramInputShown = true;
    this._diagramNameValidator.on(this._diagramCreationState);

    // The templating update must happen before we can set the focus.
    window.setTimeout(() => {
      this.createNewDiagramInput.focus();
    }, 0);

    document.addEventListener('click', this._onCreateNewDiagramClickEvent);
    document.addEventListener('keyup', this._onCreateNewDiagramKeyupEvent);
  }

  public isCreateDiagramInputShown(): boolean {
    return this._diagramCreationState.isCreateDiagramInputShown;
  }

  @computedFrom('_validationController.errors.length')
  public get diagramCreationErrors(): Array<ValidateResult> {
    return this._validationController.errors;
  }

  @computedFrom('_validationController.errors.length')
  public get hasDiagramCreationErrors(): boolean {
    return this._validationController.errors && this._validationController.errors.length > 0;
  }

  public shouldFileIconBeShown(): boolean {
    return false;
  }

  public shouldUnsavedIconBeShown(): boolean {
    return true;
  }

  public canRenameDiagram(): boolean {
    return false;
  }

  public canDeleteDiagram(): boolean {
    return false;
  }

  public get solutionIsNotLoaded(): boolean {
    return this._openedSolution === null || this._openedSolution === undefined;
  }

  public get openedDiagrams(): Array<IDiagram> {
    if (this._openedSolution) {
      return this._openedSolution.diagrams;
    } else {
      return [];
    }
  }

  // TODO: This method is copied all over the place.
  public async navigateToDetailView(diagram: IDiagram): Promise<void> {
    // TODO: Remove this if cause if we again have one detail view.
    const diagramIsOpenedFromRemote: boolean = diagram.uri.startsWith('http');

    if (diagramIsOpenedFromRemote) {
      await this._router.navigateToRoute(this._diagramRoute, {
        processModelId: diagram.id,
        view: this._inspectView,
      });

    } else {

      const navigationResult: boolean = await this._router.navigateToRoute('diagram-detail', {
        diagramUri: diagram.uri,
      });

      // This is needed, because navigateToRoute returns an object even though a boolean should be returned
      const navigationSuccessful: boolean = (typeof(navigationResult) === 'boolean')
        ? navigationResult
        : (navigationResult as PipelineResult).completed;

      if (navigationSuccessful) {
        // TODO: This should be moved into the diagram-detail component.
        this._eventAggregator.publish(environment.events.navBar.updateProcess, diagram);
      }
    }
  }

  /**
   * The event listener used to handle mouse clicks during the diagram
   * creation.
   *
   * The listener will try to finish the diagram creation if the user clicks
   * on another element then the input.
   */
  private _onCreateNewDiagramClickEvent = async(event: MouseEvent): Promise<void> => {
    const inputWasClicked: boolean = event.target === this.createNewDiagramInput;
    if (inputWasClicked) {
      return;
    }

    const emptyDiagram: IDiagram = await this._finishDiagramCreation();
    if (emptyDiagram === undefined) {
      return;
    }

    this.updateSolution();
    this._resetDiagramCreation();
    this.navigateToDetailView(emptyDiagram);
  }

  /**
   * The event listener used to handle keyboard events during the diagram
   * creation.
   *
   * The listener will try to finish the diagram creation if the user presses
   * the enter key. It will abort the creation if the escape key is pressed.
   */
  private _onCreateNewDiagramKeyupEvent = async(event: KeyboardEvent): Promise<void> => {
    const pressedKey: string = event.key;

    if (pressedKey === ENTER_KEY) {

      const emptyDiagram: IDiagram = await this._finishDiagramCreation();
      if (emptyDiagram === undefined) {
        return;
      }

      this.updateSolution();
      this._resetDiagramCreation();
      this.navigateToDetailView(emptyDiagram);

    } else if (pressedKey === ESCAPE_KEY) {
      this._resetDiagramCreation();
    }
  }

  /**
   * @return true, if the input has some non empty value.
   */
  private _hasNonEmptyValue(input: HTMLInputElement): boolean {
    const inputValue: string = input.value;

    const inputHasValue: boolean = inputValue !== undefined
                                && inputValue !== null
                                && inputValue !== '';

    return inputHasValue;
  }

  /**
   * Finishes the diagram creation. This method will again run the validation
   * and ensures that all input is correct. Otherwise an error is displayed to
   * the user.
   *
   * If no input element was empty, the diagram creation will be aborted.
   * If the validation passes, the diagram will be created and returned.
   */
  private async _finishDiagramCreation(): Promise<IDiagram> {
    const inputHasNoValue: boolean = !this._hasNonEmptyValue(this.createNewDiagramInput);
    if (inputHasNoValue) {
      this._resetDiagramCreation();
      return;
    }

    const validationResult: ControllerValidateResult = await this._validationController.validate();
    const inputWasNotValid: boolean = !validationResult.valid
                                      || (this._validationController.errors
                                          && this._validationController.errors.length > 0);

    if (inputWasNotValid) {
      const message: string = 'Please resolve all errors first.';
      this._notificationService.showNotification(NotificationType.INFO, message);
      return;
    }

    const emptyDiagram: IDiagram = this._diagramCreationService
      .createNewDiagram(this._openedSolution.uri, this._diagramCreationState.currentDiagramInputValue);

    try {
      await this.solutionService.saveDiagram(emptyDiagram, emptyDiagram.uri);
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR, error.message);
      return;
    }

    return emptyDiagram;
  }

  /**
   * Resets the diagram creation state to its default. Any listeners will be
   * removed and input values will be cleared.
   */
  private _resetDiagramCreation(): void {
    // Remove all used event listeners.
    document.removeEventListener('click', this._onCreateNewDiagramClickEvent);
    document.removeEventListener('keyup', this._onCreateNewDiagramKeyupEvent);

    // Reset input field.
    this._diagramCreationState.currentDiagramInputValue = '';
    this.createNewDiagramInput.value = '';
    // Hide input field.
    this._diagramCreationState.isCreateDiagramInputShown = false;

    ValidationRules.off(this._diagramCreationState);
  }

  private _findURIObject<T extends {uri: string}>(objects: Array<T> , targetURI: string): T {
    const foundObject: T = objects.find((object: T): boolean => {
      return object.uri.toLowerCase() === targetURI.toLowerCase();
    });

    return foundObject;
  }

  private _disposeSubscriptions(): void {
    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

}
