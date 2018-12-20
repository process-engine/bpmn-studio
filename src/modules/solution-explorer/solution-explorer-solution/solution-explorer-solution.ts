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

import {IDiagramCreationService, ISolutionEntry, ISolutionService, IUserInputValidationRule} from '../../../contracts';
import {NotificationType} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../notification/notification.service';
import {SingleDiagramsSolutionExplorerService} from '../../solution-explorer-services/SingleDiagramsSolutionExplorerService';

const ENTER_KEY: string = 'Enter';
const ESCAPE_KEY: string = 'Escape';

interface IDiagramNameInputState {
  currentDiagramInputValue: string;
}

interface IDiagramCreationState extends IDiagramNameInputState {
  isCreateDiagramInputShown: boolean;
}

@inject(
  Router,
  EventAggregator,
  NewInstance.of(ValidationController),
  'DiagramCreationService',
  'NotificationService',
  'SolutionService',
)
export class SolutionExplorerSolution {

  public activeDiagram: IDiagram;

  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _validationController: ValidationController;
  private _diagramCreationService: IDiagramCreationService;
  private _notificationService: NotificationService;
  private _solutionService: ISolutionService;

  private _diagramRoute: string = 'diagram-detail';
  private _inspectView: string;
  private _subscriptions: Array<Subscription>;
  private _openedSolution: ISolution;
  private _diagramCreationState: IDiagramCreationState = {
    currentDiagramInputValue: undefined,
    isCreateDiagramInputShown: false,
  };
  private _diagramRenamingState: IDiagramNameInputState = {
    currentDiagramInputValue: undefined,
  };
  private _refreshIntervalTask: any;

  private _diagramValidationRegExpList: IUserInputValidationRule = {
    alphanumeric: /^[a-z0-9]/i,
    specialCharacters: /^[._ -]/i,
    german: /^[äöüß]/i,
  };

  private _currentlyRenamingDiagram: IDiagram | null = null;
  private _diagramNameValidator: FluentRuleCustomizer<IDiagramNameInputState, IDiagramNameInputState> = ValidationRules
      .ensure((state: IDiagramNameInputState) => state.currentDiagramInputValue)
      .required()
      .withMessage('Diagram name cannot be blank.')
      .satisfies((input: string) => {
        const inputAsCharArray: Array<string> = input.split('');

        const diagramNamePassesNameChecks: boolean = !inputAsCharArray.some((letter: string) => {
          for (const regExIndex in this._diagramValidationRegExpList) {
            const letterIsInvalid: boolean = letter.match(this._diagramValidationRegExpList[regExIndex]) !== null;

            if (letterIsInvalid) {
              return false;
            }
          }

          return true;
        });

        return diagramNamePassesNameChecks;
      })
      .withMessage(`Your diagram contains at least one invalid-character: \${$value}`)
      .satisfies((input: string) => {
        const diagramDoesNotStartWithWhitespace: boolean = !input.match(/^\s/);

        return diagramDoesNotStartWithWhitespace;
      })
      .withMessage('The diagram name can not start with a whitespace character.')
      .satisfies((input: string) => {
        const diagramDoesNotEndWithWhitespace: boolean = !input.match(/\s+$/);

        return diagramDoesNotEndWithWhitespace;
      })
      .withMessage('The diagram name can not end with a whitespace character.')
      .then()
      .satisfies(async(input: string) => {
        const diagramNameIsUnchanged: boolean = this._currentlyRenamingDiagram && this._currentlyRenamingDiagram.name === input;
        if (diagramNameIsUnchanged) {
          return true;
        }

        // The solution may have changed on the file system.
        await this.updateSolution();

        const diagramUri: string = `${this._openedSolution.uri}/${input}.bpmn`;
        const diagramWithUriDoesNotExist: boolean = this.
          _findURIObject(this._openedSolution.diagrams, diagramUri) === undefined;

        return diagramWithUriDoesNotExist;
      })
      .withMessage('A diagram with that name already exists.');

  // Fields below are bound from the html view.
  @bindable public solutionService: ISolutionExplorerService;
  @bindable public solutionIsSingleDiagrams: boolean;
  @bindable public displayedSolutionEntry: ISolutionEntry;
  @bindable public currentOpenedRootSolutionUri: string;

  public createNewDiagramInput: HTMLInputElement;
  public _renameDiagramInput: HTMLInputElement;

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    validationController: ValidationController,
    diagramCreationService: IDiagramCreationService,
    notificationService: NotificationService,
    solutionService: ISolutionService,
  ) {
    this._router = router;
    this._eventAggregator = eventAggregator;
    this._validationController = validationController;
    this._diagramCreationService = diagramCreationService;
    this._notificationService = notificationService;
    this._solutionService = solutionService;
  }

  public attached(): void {
    this._updateSolutionExplorer();

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.processSolutionPanel.navigateToInspect, (inspectView?: string) => {
        this._diagramRoute = 'inspect';

        const inspectViewIsNotSet: boolean = inspectView === undefined;

        this._inspectView = inspectViewIsNotSet
                              ? 'heatmap'
                              : inspectView;
      }),

      this._eventAggregator.subscribe(environment.events.processSolutionPanel.navigateToDesigner, () => {
        this._diagramRoute = 'diagram-detail';
        this._inspectView = undefined;
      }),
      this._eventAggregator.subscribe('router:navigation:success', () => {
        this._updateSolutionExplorer();
      }),
    ];

    this._refreshIntervalTask = setInterval(async() =>  {
      this.updateSolution();
    }, environment.processengine.solutionExplorerPollingIntervalInMs);

  }

  public detached(): void {
    clearInterval(this._refreshIntervalTask);
    this._disposeSubscriptions();

    if (this.isCreateDiagramInputShown()) {
      this._resetDiagramCreation();
    }

    if (this._isCurrentlyRenamingDiagram()) {
      this._resetDiagramRenaming();
    }
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
  public async closeDiagram(diagram: IDiagram, event: Event): Promise<void> {
    event.stopPropagation();

    const singleDiagramService: SingleDiagramsSolutionExplorerService = this.solutionService as SingleDiagramsSolutionExplorerService;
    singleDiagramService.closeSingleDiagram(diagram);
  }

  public async deleteDiagram(diagram: IDiagram, event: Event): Promise<void> {
    event.stopPropagation();

    if (await this._isDiagramDetailViewOfDiagramOpen(diagram.uri)) {
      const messageTitle: string = '<h4 class="toast-message__headline">Not supported while opened.</h4>';
      const messageBody: string = 'Deleting of opened diagrams is currently not supported. Please switch to another diagram and try again.';
      const message: string = `${messageTitle}\n${messageBody}`;

      this._notificationService.showNotification(NotificationType.INFO, message);

      return;
    }

    try {
      await this.solutionService.deleteDiagram(diagram);
    } catch (error) {
      const message: string = `Unable to delete the diagram: ${error.message}`;

      this._notificationService.showNotification(NotificationType.ERROR, message);
    }

    await this.updateSolution();
  }

  public async startRenamingOfDiagram(diagram: IDiagram, event: Event): Promise<void> {
    event.stopPropagation();

    if (await this._isDiagramDetailViewOfDiagramOpen(diagram.uri)) {
      const messageTitle: string = '<h4 class="toast-message__headline">Not supported while opened.</h4>';
      const messageBody: string = 'Renaming of opened diagrams is currently not supported. Please switch to another diagram and try again.';
      const message: string = `${messageTitle}\n${messageBody}`;

      this._notificationService.showNotification(NotificationType.INFO, message);

      return;
    }

    if (this._isCurrentlyRenamingDiagram()) {
      return;
    }

    // Dont allow renaming diagram, if already creating another.
    if (this.isCreateDiagramInputShown()) {
      return;
    }

    // This shows the input field.
    this._currentlyRenamingDiagram = diagram;

    // The templating update must happen before we can set the focus.
    window.setTimeout(() => {
      this._renameDiagramInput.focus();
      this._diagramRenamingState.currentDiagramInputValue = diagram.name;
      this._diagramNameValidator.on(this._diagramRenamingState);
      this._validationController.validate();
    }, 0);

    document.addEventListener('click', this._onRenameDiagramClickEvent);
    document.addEventListener('keyup', this._onRenameDiagramKeyupEvent);
  }

  public set renameDiagramInput(input: HTMLInputElement) {
    this._renameDiagramInput = input;
  }

  /*
   * Called by the parent component to start the creation dialog of a new
   * diagram.
   */
  public async startCreationOfNewDiagram(): Promise<void> {
    if (this.isCreateDiagramInputShown()) {
      return;
    }

    // Dont allow new diagram creation, if already renaming another diagram.
    if (this._isCurrentlyRenamingDiagram()) {
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

  public _isCurrentlyRenamingDiagram(): boolean {
    return this._currentlyRenamingDiagram !== null;
  }

  @computedFrom('_validationController.errors.length')
  public get diagramValidationErrors(): Array<ValidateResult> {
    const validationErrorPresent: boolean = this._validationController.errors.length >= 1;
    if (validationErrorPresent) {
      this._setInvalidCharacterMessage(this._validationController.errors);
    }

    return this._validationController.errors;
  }

  @computedFrom('_validationController.errors.length')
  public get hasValidationErrors(): boolean {
    return this._validationController.errors && this._validationController.errors.length > 0;
  }

  @computedFrom('_currentlyRenamingDiagram')
  public get currentlyRenamingDiagramUri(): string {
    return this._currentlyRenamingDiagram === null ? null : this._currentlyRenamingDiagram.uri;
  }

  public shouldFileIconBeShown(): boolean {
    return false;
  }

  public canRenameDiagram(): boolean {
    return !this.solutionIsSingleDiagrams
            && this._openedSolution
            && !this._openedSolution.uri.startsWith('http');
  }

  public canDeleteDiagram(): boolean {
    return !this.solutionIsSingleDiagrams && this._openedSolution !== undefined;
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
    const diagramIsNoRemoteDiagram: boolean = !diagram.uri.startsWith('http');

    if (diagramIsNoRemoteDiagram) {
      this._inspectView = 'dashboard';
      this._eventAggregator.publish(environment.events.navBar.inspectNavigateToDashboard);

      const activeRouteIsInspect: boolean = this._diagramRoute === 'inspect';
      if (activeRouteIsInspect) {
        this._notificationService.showNotification(NotificationType.INFO,
          'There are currently no runtime information about this process available.');
      }
    }

    await this._router.navigateToRoute(this._diagramRoute, {
      view: this._inspectView,
      diagramName: diagram.name,
      solutionUri: this.displayedSolutionEntry.uri,
    });

  }

  @computedFrom('activeDiagram.uri')
  public get activeDiagramUri(): string {
    const activeDiagramIsNotSet: boolean = this.activeDiagram === undefined;
    if (activeDiagramIsNotSet) {
      return undefined;
    }

    if (!this.activeDiagram.uri.includes(this.currentOpenedRootSolutionUri)) {
      return;
    }

    return this.activeDiagram.uri;
  }

  private async _isDiagramDetailViewOfDiagramOpen(diagramUriToCheck: string): Promise<boolean> {
    const activeDiagramIsUndefined: boolean = this.activeDiagram === undefined;
    if (activeDiagramIsUndefined) {
      return false;
    }

    const openedDiagramUri: string = this.activeDiagram.uri;
    const diagramIsOpened: boolean = diagramUriToCheck === openedDiagramUri;
    return diagramIsOpened;
  }

  /**
   * Looks in the given Array of validation errors for an invalid character
   * error message and replace the messages content with the acutal
   * message and returns a reference to a new array with the mod
   *
   * TODO: This method should create a deep copy of an array that contains
   * errors and return it instead of just modifying the reference.
   *
   */
  private _setInvalidCharacterMessage(errors: Array<ValidateResult>): void {
    const invalidCharacterString: string = 'Your diagram contains at least one invalid-character: ';

    for (const currentError of this._validationController.errors) {
      const validationErrorIsInvalidCharacter: boolean = currentError.message.startsWith(invalidCharacterString);

      if (validationErrorIsInvalidCharacter) {
        const inputToValidate: string = currentError.message.replace(invalidCharacterString, '');

        const invalidCharacters: Array<string> = this._getInvalidCharacters(inputToValidate);

        currentError.message = this._getInvalidCharacterErrorMessage(invalidCharacters);
      }
    }
  }

  /**
   *  Searches in the given input string for all invalid characters and returns
   *  them as a char array.
   *
   * @param input input that contains invalid characters.
   * @param returns An array that contains all invalid characters.
   */
  private _getInvalidCharacters(input: string): Array<string> {
    const inputLetters: Array<string> = input.split('');
    const invalidCharacters: Array<string> = inputLetters.filter((letter: string) => {
      const rules: Array<RegExp> = Object.values(this._diagramValidationRegExpList);
      const letterIsInvalid: boolean = !rules.some((regExp: RegExp) => {
        return letter.match(regExp) !== null;
      });

      return letterIsInvalid;
    });

    return invalidCharacters;
  }

  /**
   * Build an error message which lists all invalid characters.
   *
   * @param invalidCharacters An array that contains all detected invalid
   * characters.
   * @return A string with an error message that contains all invalid characters
   * of a diagram name.
   */
  private _getInvalidCharacterErrorMessage(invalidCharacters: Array<string>): string {

    // This filters all duplicate invalid characters so that the list contains each character only once.
    const filteredInvalidCharacters: Array<string> =
      invalidCharacters.filter((current: string, index: number): boolean => {
        return invalidCharacters.indexOf(current) === index;
      });

    const messagePrefix: string = 'Your diagram contains at least one invalid-character: ';

    // Replaces the commas between the invalid characters by a space to increase readability.
    const invalidCharacterString: string = `${filteredInvalidCharacters}`.replace(/(.)./g, '$1 ');

    return `${messagePrefix} ${invalidCharacterString}`;
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
   * The event listener used to handle mouse clicks during the diagram
   * renaming.
   *
   * The listener will try to finish the diagram renaming if the user clicks
   * on another element then the input. It will abort if there are any
   * validation errors.
   */
  private _onRenameDiagramClickEvent = async(event: MouseEvent): Promise<void> => {
    const inputWasClicked: boolean = event.target === this._renameDiagramInput;
    if (inputWasClicked) {
      return;
    }

    const inputWasNotValid: boolean = !await this._finishDiagramRenaming(true);
    if (inputWasNotValid) {
      this._resetDiagramRenaming();

      return;
    }

    this.updateSolution();
    this._resetDiagramRenaming();
  }

  /**
   * The event listener used to handle keyboard events during the diagram
   * renaming.
   *
   * The listener will try to finish the diagram creation if the user presses
   * the enter key. It will abort the creation if the escape key is pressed. It
   * will not abort the diagram renaming, if there are validation errors.
   */
  private _onRenameDiagramKeyupEvent = async(event: KeyboardEvent): Promise<void> => {
    const pressedKey: string = event.key;

    const enterWasPressed: boolean = pressedKey === ENTER_KEY;
    const escapeWasPressed: boolean = pressedKey === ESCAPE_KEY;

    if (enterWasPressed) {
      const inputWasNotValid: boolean = !await this._finishDiagramRenaming(false);
      if (inputWasNotValid) {
        return;
      }

      this.updateSolution();
      this._resetDiagramRenaming();

    } else if (escapeWasPressed) {
      this._resetDiagramRenaming();
    }
  }

  /**
   * Checks, if the input contains any non empty values.
   *
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
   * Finishes the diagram renaming process. This method will again run the
   * validation and ensures that all input is correct. Otherwise an error is
   * displayed to the user.
   *
   * If the validation passes, the diagram will be created and returned.
   *
   * @param silent if a notification should be shown on validation failure.
   * @returns true if the diagram was renamed, false otherwise.
   */
  private async _finishDiagramRenaming(silent: boolean): Promise<boolean> {
    const validationResult: ControllerValidateResult = await this._validationController.validate();
    const inputWasNotValid: boolean = !validationResult.valid
                                      || (this._validationController.errors
                                          && this._validationController.errors.length > 0);

    if (inputWasNotValid) {
      if (!silent) {
        const message: string = 'Please resolve all errors first.';

        this._notificationService.showNotification(NotificationType.INFO, message);
      }

      return false;
    }

    const filenameWasNotChanged: boolean = this._currentlyRenamingDiagram.name === this._diagramRenamingState.currentDiagramInputValue;
    if (filenameWasNotChanged) {
      return true;
    }

    try {
      await this.solutionService.renameDiagram(this._currentlyRenamingDiagram, this._diagramRenamingState.currentDiagramInputValue);
    } catch (error) {
      this._notificationService.showNotification(NotificationType.WARNING, error.message);

      return false;
    }

    return true;
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
   * Resets the diagram renaming state to its default. Any listeners will be
   * removed and input values will be cleared.
   */
  private _resetDiagramRenaming(): void {
    // Remove all used event listeners.
    document.removeEventListener('click', this._onRenameDiagramClickEvent);
    document.removeEventListener('keyup', this._onRenameDiagramKeyupEvent);

    // Reset input field.
    this._diagramRenamingState.currentDiagramInputValue = '';
    this._renameDiagramInput.value = '';
    // Hide input field.
    this._currentlyRenamingDiagram = null;

    ValidationRules.off(this._diagramRenamingState);
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

  private async _updateSolutionExplorer(): Promise<void> {
    const solutionUri: string = this._router.currentInstruction.queryParams.solutionUri;
    const solutionUriSpecified: boolean = solutionUri !== undefined;
    const diagramName: string = this._router.currentInstruction.params.diagramName;
    const diagramNameIsSpecified: boolean = diagramName !== undefined;

    const routeName: string = this._router.currentInstruction.config.name;
    const routeNameIsDiagramDetailOrInspect: boolean = routeName === 'diagram-detail'
                                                    || routeName === 'inspect';
    if (routeNameIsDiagramDetailOrInspect) {
      this._diagramRoute = routeName;
      this._inspectView = this._router.currentInstruction.params.view;
    }

    if (solutionUriSpecified && diagramNameIsSpecified) {
      try {
        const activeSolution: ISolution = await this.solutionService.loadSolution();
        this.activeDiagram = activeSolution.diagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });
      } catch (error) {
        this.activeDiagram = undefined;
      }

      return;
    }

    this.activeDiagram = undefined;
  }
}
