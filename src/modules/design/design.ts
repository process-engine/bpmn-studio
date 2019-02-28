/* tslint:disable:no-use-before-declare */
/**
 * We are disabling this rule here because we need this kind of statement in the
 * functions used in the promise of the modal.
*/

import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, bindingMode, inject} from 'aurelia-framework';
import {activationStrategy, NavigationInstruction, Redirect, Router} from 'aurelia-router';

import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {DiagramDetail} from './diagram-detail/diagram-detail';

export interface IDesignRouteParameters {
  view?: string;
  diagramName?: string;
  solutionUri?: string;
}

type IEventListener = {
  name: string,
  function: Function,
};

type DiagramWithSolution = {
  diagram: IDiagram,
  solutionName: string,
  solutionUri: string,
};

@inject(EventAggregator, 'SolutionService', Router, 'NotificationService')
export class Design {

  @bindable() public activeDiagram: IDiagram;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  @bindable() public xmlForDiff: string;
  @bindable({defaultBindingMode: bindingMode.oneWay}) public xml: string;

  public showQuitModal: boolean = false;
  public showLeaveModal: boolean = false;
  public showSelectDiagramModal: boolean = false;

  public showDetail: boolean = true;
  public showXML: boolean = false;
  public showDiff: boolean = false;
  public propertyPanelShown: boolean = false;
  public showPropertyPanelButton: boolean = true;
  public showDiffDestinationButton: boolean = false;
  public design: Design = this;

  public diagramDetail: DiagramDetail;
  public filteredSolutions: Array<ISolution> = [];
  public diagramArray: Array<IDiagram | object> = [];
  public selectedDiagram: DiagramWithSolution;

  private _eventAggregator: EventAggregator;
  private _notificationService: NotificationService;
  private _solutionService: ISolutionService;
  private _subscriptions: Array<Subscription>;
  private _router: Router;
  private _routeView: string;
  private _ipcRenderer: any;
  private _ipcRendererEventListeners: Array<IEventListener> = [];

  constructor(eventAggregator: EventAggregator, solutionService: ISolutionService, router: Router, notificationService: NotificationService) {
    this._eventAggregator = eventAggregator;
    this._solutionService = solutionService;
    this._router = router;
    this._notificationService = notificationService;
  }

  public async activate(routeParameters: IDesignRouteParameters): Promise<void> {
    const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);
    if (isRunningInElectron) {
      this._prepareSaveModalForClosing();
    }

    const solutionIsSet: boolean = routeParameters.solutionUri !== undefined;
    const diagramNameIsSet: boolean = routeParameters.diagramName !== undefined;

    const routerAndInstructionIsNotNull: boolean = this._router !== null
                                                && this._router.currentInstruction !== null;

    const diagramNamesAreDifferent: boolean = routerAndInstructionIsNotNull
                                              ? routeParameters.diagramName !== this._router.currentInstruction.params.diagramName
                                              : true;

    const solutionIsDifferent: boolean = routerAndInstructionIsNotNull
                                        ? routeParameters.solutionUri !== this._router.currentInstruction.queryParams.solutionUri
                                        : true;

    const routeFromOtherView: boolean = routerAndInstructionIsNotNull
                                      ? this._router.currentInstruction.config.name !== 'design'
                                      : true;

    const navigateToAnotherDiagram: boolean = diagramNamesAreDifferent || routeFromOtherView || solutionIsDifferent;

    if (solutionIsSet) {
      this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(routeParameters.solutionUri);

      /**
       * We have to open the solution here again since if we come here after a
       * reload the solution might not be opened yet.
       */
      await this.activeSolutionEntry.service.openSolution(this.activeSolutionEntry.uri, this.activeSolutionEntry.identity);

      const solutionIsRemote: boolean = this.activeSolutionEntry.uri.startsWith('http');
      if (solutionIsRemote) {
        this._eventAggregator.publish(environment.events.configPanel.processEngineRouteChanged, this.activeSolutionEntry.uri);
      }

      const isSingleDiagram: boolean = this.activeSolutionEntry.uri === 'Single Diagrams';

      if (isSingleDiagram) {
        const persistedDiagrams: Array<IDiagram> = this._solutionService.getSingleDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === routeParameters.diagramName;
        });

      } else {

        this.activeDiagram = diagramNameIsSet
                            ? await this.activeSolutionEntry.service.loadDiagram(routeParameters.diagramName)
                            : undefined;
      }

      const diagramNotFound: boolean = this.activeDiagram === undefined;

      if (diagramNotFound) {
        this._router.navigateToRoute('start-page');
        this._notificationService.showNotification(NotificationType.INFO, 'Diagram could not be opened!');
      }

      if (navigateToAnotherDiagram) {
        this.xml = this.activeDiagram.xml;
      }
    }

    const routeViewIsDetail: boolean = routeParameters.view === 'detail';
    const routeViewIsXML: boolean = routeParameters.view === 'xml';
    const routeViewIsDiff: boolean = routeParameters.view === 'diff';
    this._routeView = routeParameters.view;

    if (routeViewIsDetail) {
      this.showDetail = true;
      this.showXML = false;
      this.showDiff = false;
      this.showPropertyPanelButton = true;
      this.showDiffDestinationButton = false;

      this._eventAggregator.publish(environment.events.bpmnio.bindKeyboard);

    } else if (routeViewIsXML) {
      this.showDetail = false;
      this.showXML = true;
      this.showDiff = false;
      this.showDiffDestinationButton = false;
      this.showPropertyPanelButton = false;

      this._eventAggregator.publish(environment.events.bpmnio.unbindKeyboard);
    } else if (routeViewIsDiff) {
      this._eventAggregator.publish(environment.events.bpmnio.unbindKeyboard);
      /**
       * We need to check this, because after a reload the diagramdetail component is not attached yet.
       */
      const diagramDetailIsNotAttached: boolean = this.diagramDetail === undefined;
      if (diagramDetailIsNotAttached) {
        this.xmlForDiff = this.activeDiagram.xml;
        return;
      }

      this.xmlForDiff = await this.diagramDetail.getXML();

      this._showDiff();
    }
  }

  public async attached(): Promise<void> {
    const routeViewIsDiff: boolean = this._routeView === 'diff';
    const routeViewIsXML: boolean = this._routeView === 'xml';

    if (routeViewIsDiff) {
      this._showDiff();
    }

    if (routeViewIsDiff || routeViewIsXML) {
      this._eventAggregator.publish(environment.events.bpmnio.unbindKeyboard);
    }

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.bpmnio.propertyPanelActive, (showPanel: boolean) => {
        this.propertyPanelShown = showPanel;
      }),
    ];

    this._eventAggregator.publish(environment.events.statusBar.showDiagramViewButtons);
  }

  public detached(): void {
    this._eventAggregator.publish(environment.events.statusBar.hideDiagramViewButtons);
    this._subscriptions.forEach((subscription: Subscription) => subscription.dispose());
  }

  public determineActivationStrategy(): string {

    return activationStrategy.invokeLifecycle;
  }

  public setDiffDestination(diffDestination: string, diagramName?: string): void {
    this._eventAggregator.publish(environment.events.diffView.setDiffDestination,
      [
        diffDestination,
        diagramName,
      ]);

    this.showSelectDiagramModal = false;
  }

  public async openSelectDiagramModal(): Promise<void> {
    this.diagramArray = [];

    const allSolutions: Array<ISolutionEntry> = this._solutionService.getAllSolutionEntries();

    const loadedSolutionPromises: Array<Promise<ISolution>> = allSolutions.map(async(value: ISolutionEntry) => {
      const loadedSolution: ISolution = await value.service.loadSolution();

      return loadedSolution;
    });

    const loadedSolutions: Array<ISolution> = await Promise.all(loadedSolutionPromises);
    this.filteredSolutions = loadedSolutions.filter((solution: ISolution) => {

      return solution.diagrams.length !== 0;
    });

    loadedSolutions.forEach((solution: ISolution) => {
      solution.diagrams.forEach((diagram: IDiagram) => {
        const diagramWithSolutionName: DiagramWithSolution = {
          diagram,
          solutionName: solution.name,
          solutionUri: solution.uri,
        };

        this.diagramArray.push(diagramWithSolutionName);
      });
    });

    const lastSaved: DiagramWithSolution = {
      diagram: this.activeDiagram,
      solutionName: 'Last Saved',
      solutionUri: 'lastSaved',
    };

    this.diagramArray.unshift(lastSaved);

    const openedDiagramIndex: number = this.diagramArray.findIndex((diagram: DiagramWithSolution) => {
      const diagramIsOpenedDiagram: boolean = diagram.solutionUri === this.activeSolutionEntry.uri
                                           && diagram.diagram.name === this.activeDiagram.name;
      return diagramIsOpenedDiagram;
    });

    this.diagramArray.splice(openedDiagramIndex, 1);

    this.showSelectDiagramModal = true;
  }

  public cancelDialog(): void {
    this.showSelectDiagramModal = false;
  }

  public togglePanel(): void {
    this._eventAggregator.publish(environment.events.bpmnio.togglePropertyPanel);
  }

  public async canDeactivate(destinationInstruction: NavigationInstruction): Promise<Redirect | boolean> {

    /**
     * Dirty quickfix: Because of this issue https://github.com/process-engine/bpmn-studio/issues/1384
     * we need to discard every routing instruction whose target uri/fragment contains
     * an already encoded character.
     */
    const instructionFragment: string = destinationInstruction.fragment;
    const instructionFragmentContainsUnescapedSpace: boolean = instructionFragment.includes('%');
    if (instructionFragmentContainsUnescapedSpace) {

      return false;
    }

    const userCanNotDeactivateRoute: boolean = !(await this.canDeactivateModal(destinationInstruction));
    if (userCanNotDeactivateRoute) {

      const redirectUrl: string = `${this._router.currentInstruction.fragment}?${this._router.currentInstruction.queryString}`;
      /*
      * As suggested in https://github.com/aurelia/router/issues/302, we use
      * the router directly to navigate back, which results in staying on this
      * component-- and this is the desired behaviour.
      */

      return new Redirect(redirectUrl, {trigger: false, replace: false});
    }
  }

  public async canDeactivateModal(currentRouteInstruction: NavigationInstruction): Promise<boolean> {
    const modalResult: Promise<boolean> = new Promise((resolve: Function, reject: Function): boolean | void => {

      const modalCanBeSuppressed: boolean = !this.diagramDetail.diagramHasChanged || this._modalCanBeSuppressed(currentRouteInstruction);
      if (modalCanBeSuppressed) {
        resolve(true);

        return;
      }

      const dontSaveAndLeaveFunction: EventListenerOrEventListenerObject = (): void => {
        this.showLeaveModal = false;
        this.diagramDetail.diagramHasChanged = false;
        this._eventAggregator.publish(environment.events.navBar.diagramChangesResolved);

        document.getElementById('dontSaveButtonLeaveView').removeEventListener('click', dontSaveAndLeaveFunction);
        document.getElementById('saveButtonLeaveView').removeEventListener('click', saveAndLeaveFunction);
        document.getElementById('cancelButtonLeaveView').removeEventListener('click', cancelAndLeaveFunction);

        resolve(true);
      };

      const saveAndLeaveFunction: EventListenerOrEventListenerObject = async(): Promise<void> => {
        if (this.diagramDetail.diagramIsInvalid) {
          resolve(false);
        }

        try {
          await this.diagramDetail.saveDiagram();
          this.diagramDetail.diagramHasChanged = false;
          this.showLeaveModal = false;

          resolve(true);
        } catch {
          return;
        }

        document.getElementById('dontSaveButtonLeaveView').removeEventListener('click', dontSaveAndLeaveFunction);
        document.getElementById('saveButtonLeaveView').removeEventListener('click', saveAndLeaveFunction);
        document.getElementById('cancelButtonLeaveView').removeEventListener('click', cancelAndLeaveFunction);
      };

      const cancelAndLeaveFunction: EventListenerOrEventListenerObject = (): void => {
        this.showLeaveModal = false;

        document.getElementById('dontSaveButtonLeaveView').removeEventListener('click', dontSaveAndLeaveFunction);
        document.getElementById('saveButtonLeaveView').removeEventListener('click', saveAndLeaveFunction);
        document.getElementById('cancelButtonLeaveView').removeEventListener('click', cancelAndLeaveFunction);

        resolve(false);
      };

      this.showLeaveModal = true;

      // register onClick handler
      document.getElementById('dontSaveButtonLeaveView').addEventListener('click', dontSaveAndLeaveFunction);
      document.getElementById('saveButtonLeaveView').addEventListener('click', saveAndLeaveFunction);
      document.getElementById('cancelButtonLeaveView').addEventListener('click', cancelAndLeaveFunction);
    });

    return modalResult;
  }

  public deactivate(): void {
    this.diagramDetail.deactivate();

    for (const eventListener of this._ipcRendererEventListeners) {
      this._ipcRenderer.removeListener(eventListener.name, eventListener.function);
    }
  }

  public activeDiagramChanged(newValue: IDiagram, oldValue: IDiagram): void {
    const activeDiagramDidNotChange: boolean = newValue.id === oldValue.id
                                            && newValue.uri === oldValue.uri;
    if (activeDiagramDidNotChange) {
      return;
    }

    this.xmlForDiff = this.activeDiagram.xml;
  }

  public get connectedRemoteSolutions(): Array<ISolutionEntry> {
    const remoteSolutions: Array<ISolutionEntry> = this._solutionService.getRemoteSolutionEntries();

    const remoteSolutionsWithoutActive: Array<ISolutionEntry> = remoteSolutions.filter((remoteSolution: ISolutionEntry) => {
      return remoteSolution.uri !== this.activeSolutionEntry.uri && remoteSolution.fontAwesomeIconClass !== 'fa-bolt';
    });

    return remoteSolutionsWithoutActive;
  }

  public get remoteSolutions(): Array<ISolutionEntry> {
    const remoteSolutions: Array<ISolutionEntry> = this._solutionService.getRemoteSolutionEntries();

    const remoteSolutionsWithoutActive: Array<ISolutionEntry> = remoteSolutions.filter((remoteSolution: ISolutionEntry) => {
      return remoteSolution.uri !== this.activeSolutionEntry.uri;
    });

    return remoteSolutionsWithoutActive;
  }

  public get showSaveBeforeDeployModal(): boolean {
    return this.diagramDetail.showSaveBeforeDeployModal;
  }

  public get showRemoteSolutionOnDeployModal(): boolean {
    return this.diagramDetail.showRemoteSolutionOnDeployModal;
  }

  public get showSaveForStartModal(): boolean {
    return this.diagramDetail.showSaveForStartModal;
  }

  public get showStartWithOptionsModal(): boolean {
    return this.diagramDetail.showStartWithOptionsModal;
  }

  public get showStartEventModal(): boolean {
    return this.diagramDetail.showStartEventModal;
  }

  public get diagramHasChanged(): boolean {
    return this.diagramDetail.diagramHasChanged;
  }

  private _showDiff(): void {
    this.showDiff = true;
    this.showDetail = false;
    this.showXML = false;
    this.showPropertyPanelButton = false;
    this.showDiffDestinationButton = true;
  }

  private _prepareSaveModalForClosing(): void {
    this._ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

    const showCloseModalEventName: string = 'show-close-modal';

    const showCloseModalFunction: Function = (): void => {
      this.showQuitModal = true;
    };

    this._ipcRenderer.on(showCloseModalEventName, showCloseModalFunction);
    this._ipcRendererEventListeners.push({
                                            name: showCloseModalEventName,
                                            function: showCloseModalFunction,
                                        });

  }

  public quitWithoutSaving(): void {
    this._ipcRenderer.send('can-not-close', false);
    this._ipcRenderer.send('close-bpmn-studio');
  }

  public async quitWithSaving(): Promise<void> {
    if (this.diagramDetail.diagramIsInvalid) {
      return;
    }

    await this.diagramDetail.saveDiagram();
    this.diagramDetail.diagramHasChanged = false;

    this._ipcRenderer.send('close-bpmn-studio');
  }

  public cancelQuitting(): void {
    this.showQuitModal = false;
  }

  /**
   * This function checks, if the 'Save unsaved changes' Modal can be
   * suppressed.
   *
   * This is the case, if the user basically navigates between the detail,
   * the xml and the diff view, since the current xml will passed between
   * these views.
   *
   * Therefore, the following paths will suppress the modal:
   *  * detail  <-->   xml
   *  * detail  <-->   diff
   *  * diff    <-->   xml
   *
   * @param destinationInstruction The current router instruction which contains
   * the destination router parameters.
   */
  private _modalCanBeSuppressed(destinationInstruction: NavigationInstruction): boolean {
    const oldView: string = this._router.currentInstruction.params.view;
    const destinationView: string = destinationInstruction.params.view;

    const navigatingBetween: Function = (routeA: string, routeB: string): boolean =>
      (routeA === oldView || routeA === destinationView) && (routeB === oldView || routeB === destinationView);

    const shouldModalBeSuppressed: boolean = navigatingBetween('diff', 'xml')
      || navigatingBetween('diff', 'detail')
      || navigatingBetween('xml', 'detail');

    return shouldModalBeSuppressed;
  }
}
