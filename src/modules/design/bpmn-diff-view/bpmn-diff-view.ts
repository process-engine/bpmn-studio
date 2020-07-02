/* eslint-disable 6river/new-cap */
/* eslint-disable no-underscore-dangle */
import {inject} from 'aurelia-dependency-injection';
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, computedFrom} from 'aurelia-framework';

import {IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {diff} from 'bpmn-js-differ';

import {
  DiffMode,
  IBpmnModdle,
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  ICanvas,
  IChangeListEntry,
  IChangedElement,
  IChangedElementList,
  IColorPickerColor,
  IDefinition,
  IDiffChangeListData,
  IDiffChanges,
  IDiffElementList,
  IElementRegistry,
  IEventFunction,
  IModeling,
  ISolutionEntry,
  IViewbox,
  NotificationType,
  defaultBpmnColors,
} from '../../../contracts/index';
import environment from '../../../environment';
import {ElementNameService} from '../../../services/elementname-service/elementname.service';
import {NotificationService} from '../../../services/notification-service/notification.service';
import {SolutionService} from '../../../services/solution-service/solution.service';

@inject('NotificationService', EventAggregator, 'SolutionService')
export class BpmnDiffView {
  public currentXml: string;
  public previousXml: string;

  @bindable() public unconvertedPreviousXml: string;
  @bindable() public unconvertedCurrentXml: string;
  @bindable() public savedXml: string;
  @bindable() public processModelId: string;
  @bindable() public deployedXml: string;

  public xmlChanges: IDiffChanges;
  public leftCanvasModel: HTMLElement;
  public rightCanvasModel: HTMLElement;
  public lowerCanvasModel: HTMLElement;
  public currentDiffMode: DiffMode = DiffMode.NewVsOld;
  public showChangeList: boolean;
  public noChangesExisting: boolean = true;
  public noChangesReason: string;
  public totalAmountOfChange: number;
  public previousXmlIdentifier: string;
  public currentXmlIdentifier: string;
  public changeListData: IDiffChangeListData = {
    removed: [],
    changed: [],
    added: [],
    layoutChanged: [],
  };

  public showSavedXml: boolean = true;

  private notificationService: NotificationService;
  private eventAggregator: EventAggregator;
  private leftViewer: IBpmnModeler;
  private rightViewer: IBpmnModeler;
  private lowerViewer: IBpmnModeler;
  private diffModeler: IBpmnModeler;
  private currentXmlModeler: IBpmnModeler;
  private previousXmlModeler: IBpmnModeler;
  private modeling: IModeling;
  private elementRegistry: IElementRegistry;
  private subscriptions: Array<Subscription>;
  private elementNameService: ElementNameService;
  private diffDestination: string = 'lastSaved';
  private diagramName: string | undefined;
  private solutionService: SolutionService;

  constructor(
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    solutionService: SolutionService,
  ) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.elementNameService = new ElementNameService();
    this.solutionService = solutionService;
  }

  public created(): void {
    this.leftViewer = this.createNewViewer();
    this.rightViewer = this.createNewViewer();
    this.lowerViewer = this.createNewViewer();

    this.diffModeler = new bundle.modeler();
    this.previousXmlModeler = new bundle.modeler();
    this.currentXmlModeler = new bundle.modeler();

    this.modeling = this.diffModeler.get('modeling');
    this.elementRegistry = this.diffModeler.get('elementRegistry');

    this.startSynchronizingViewers();
  }

  public async attached(): Promise<void> {
    this.leftViewer.attachTo(this.leftCanvasModel);
    this.rightViewer.attachTo(this.rightCanvasModel);
    this.lowerViewer.attachTo(this.lowerCanvasModel);

    this.syncAllViewers();

    this.subscriptions = [
      this.eventAggregator.subscribe(environment.events.diffView.changeDiffMode, (diffMode: DiffMode) => {
        this.currentDiffMode = diffMode;

        this.updateDiffView();
      }),

      this.eventAggregator.subscribe(environment.events.diffView.toggleChangeList, () => {
        this.showChangeList = !this.showChangeList;
      }),

      this.eventAggregator.subscribe(environment.events.diffView.setDiffDestination, async (data: Array<string>) => {
        [this.diffDestination, this.diagramName] = data;

        const diffLastSavedXml: boolean = this.diffDestination === 'lastSaved';
        if (diffLastSavedXml) {
          this.setSavedProcessModelAsPreviousXml();
        } else {
          const updatingDeployedXmlWasSuccessful: boolean = await this.updateDeployedXml();
          const diagramNameIsSet: boolean = this.diagramName !== undefined;

          if (updatingDeployedXmlWasSuccessful && diagramNameIsSet) {
            this.setCustomProcessModelAsPreviousXml();

            return;
          }

          if (updatingDeployedXmlWasSuccessful) {
            this.setDeployedProcessModelAsPreviousXml();
          }
        }
      }),
    ];
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public savedXmlChanged(): void {
    if (this.showSavedXml) {
      this.setSavedProcessModelAsPreviousXml();
    }
  }

  public async processModelIdChanged(): Promise<void> {
    const hasNoProcessModelId: boolean = this.processModelId === undefined;
    if (hasNoProcessModelId) {
      this.deployedXml = undefined;

      return;
    }

    const updatingDeploydedXmlWasSuccessfull: boolean = await this.updateDeployedXml();
    if (updatingDeploydedXmlWasSuccessfull) {
      return;
    }

    this.diffDestination = 'lastSaved';
    this.setSavedProcessModelAsPreviousXml();
  }

  public deployedXmlChanged(): void {
    const processModelIsDeployed: boolean = this.deployedXml !== undefined;

    this.eventAggregator.publish(environment.events.bpmnio.showDiffDestinationButton, processModelIsDeployed);
  }

  public async unconvertedPreviousXmlChanged(): Promise<void> {
    await this.importXml(this.unconvertedPreviousXml, this.previousXmlModeler);

    this.previousXml = await this.exportXml(this.previousXmlModeler);

    this.importXml(this.previousXml, this.rightViewer);

    await this.updateXmlChanges();
    this.updateDiffView();
  }

  public async unconvertedCurrentXmlChanged(): Promise<void> {
    await this.importXml(this.unconvertedCurrentXml, this.currentXmlModeler);

    this.currentXml = await this.exportXml(this.currentXmlModeler);

    this.importXml(this.currentXml, this.leftViewer);

    await this.updateXmlChanges();
    this.updateDiffView();
  }

  public togglePreviousXml(): void {
    this.showSavedXml = !this.showSavedXml;

    if (this.showSavedXml) {
      this.setSavedProcessModelAsPreviousXml();
    } else {
      this.setDeployedProcessModelAsPreviousXml();
    }
  }

  @computedFrom('currentDiffMode')
  public get diffModeIsNewVsOld(): boolean {
    return this.currentDiffMode === DiffMode.NewVsOld;
  }

  @computedFrom('currentDiffMode')
  public get diffModeIsOldVsNew(): boolean {
    return this.currentDiffMode === DiffMode.OldVsNew;
  }

  private syncAllViewers(): void {
    const lowerCanvas: ICanvas = this.lowerViewer.get('canvas');
    const leftCanvas: ICanvas = this.leftViewer.get('canvas');
    const rightCanvas: ICanvas = this.rightViewer.get('canvas');

    const changedViewbox: IViewbox = lowerCanvas.viewbox();
    leftCanvas.viewbox(changedViewbox);
    rightCanvas.viewbox(changedViewbox);
  }

  private setDeployedProcessModelAsPreviousXml(): void {
    this.unconvertedPreviousXml = this.deployedXml;

    this.previousXmlIdentifier = 'Deployed';
    this.currentXmlIdentifier = 'Filesystem';

    this.eventAggregator.publish(environment.events.statusBar.setXmlIdentifier, [
      this.previousXmlIdentifier,
      this.currentXmlIdentifier,
    ]);
  }

  private setCustomProcessModelAsPreviousXml(): void {
    this.unconvertedPreviousXml = this.deployedXml;

    this.previousXmlIdentifier = this.diagramName;
    this.currentXmlIdentifier = this.processModelId;

    this.eventAggregator.publish(environment.events.statusBar.setXmlIdentifier, [
      this.previousXmlIdentifier,
      this.currentXmlIdentifier,
    ]);

    this.diagramName = undefined;
  }

  private setSavedProcessModelAsPreviousXml(): void {
    this.unconvertedPreviousXml = this.savedXml;

    this.previousXmlIdentifier = 'Old';
    this.currentXmlIdentifier = 'New';

    this.eventAggregator.publish(environment.events.statusBar.setXmlIdentifier, [
      this.previousXmlIdentifier,
      this.currentXmlIdentifier,
    ]);
  }

  private async updateDeployedXml(): Promise<boolean> {
    const activeSolutionEntry: ISolutionEntry = this.solutionService.getSolutionEntryForUri(this.diffDestination);

    const activeSolutionEntryNotFound: boolean = activeSolutionEntry === undefined;
    if (activeSolutionEntryNotFound) {
      return false;
    }

    const diagramName: string = this.diagramName ? this.diagramName : this.processModelId;

    const getXmlFromDeployed: () => Promise<string> = async (): Promise<string> => {
      try {
        const diagram: IDiagram = await activeSolutionEntry.service.loadDiagram(diagramName);

        const diagramFound: boolean = diagram !== undefined;

        return diagramFound ? diagram.xml : undefined;
      } catch {
        return undefined;
      }
    };

    this.deployedXml = await getXmlFromDeployed();
    const diagramIsNotDeployed: boolean = this.deployedXml === undefined;

    const diffingAgainstDeployed: boolean = this.diffDestination !== 'lastSaved';
    if (diagramIsNotDeployed && diffingAgainstDeployed) {
      const errorMessage: string =
        'Could not diff against the deployed version: This diagram is not deployed to the ProcessEngine.';
      this.notificationService.showNotification(NotificationType.ERROR, errorMessage);

      return false;
    }

    return true;
  }

  private async updateXmlChanges(): Promise<void> {
    /**
     * TODO: This is a dirty fix, so that the model parser does not
     * get an undefined string.
     *
     * We need to find out, where this value gets set to undefined
     * and prevent this issue there.
     */
    const previousXmlIsNotDefined: boolean = this.previousXml === undefined;
    if (previousXmlIsNotDefined) {
      this.previousXml = this.currentXml;
    }

    const previousDefinitions: IDefinition = await this.getDefintionsFromXml(this.previousXml);
    const newDefinitions: IDefinition = await this.getDefintionsFromXml(this.currentXml);

    this.xmlChanges = diff(previousDefinitions, newDefinitions);
    this.prepareChangesForChangeList();
  }

  private async getDefintionsFromXml(xml: string): Promise<any> {
    const moddle: IBpmnModdle = this.diffModeler.get('moddle');

    const {rootElement: definitions} = await moddle.fromXML(xml);

    return definitions;
  }

  private getChangeListEntriesFromChanges(
    elementChanges: IDiffElementList | IChangedElementList,
  ): Array<IChangeListEntry> {
    const changeListEntries: Array<IChangeListEntry> = [];
    const elementIds: Array<string> = Object.keys(elementChanges);

    for (const elementId of elementIds) {
      const elementChange: any = elementChanges[elementId];

      const isElementAChangedElement: boolean = elementChange.$type === undefined;
      const changeListEntry: IChangeListEntry = isElementAChangedElement
        ? this.createChangeListEntry(elementChange.model.name, elementChange.model.$type)
        : this.createChangeListEntry(elementChange.name, elementChange.$type);

      changeListEntries.push(changeListEntry);
    }

    return changeListEntries;
  }

  /*
   * This function converts the object from the bpmn-differ into an object with arrays
   * to make it loopable in the html.
   */
  private prepareChangesForChangeList(): void {
    this.changeListData.removed = [];
    this.changeListData.changed = [];
    this.changeListData.added = [];
    this.changeListData.layoutChanged = [];

    const changedElement: IChangedElementList = this.removeElementsWithoutChanges(this.xmlChanges._changed);

    this.changeListData.removed = this.getChangeListEntriesFromChanges(this.xmlChanges._removed);
    this.changeListData.changed = this.getChangeListEntriesFromChanges(changedElement);
    this.changeListData.added = this.getChangeListEntriesFromChanges(this.xmlChanges._added);
    this.changeListData.layoutChanged = this.getChangeListEntriesFromChanges(this.xmlChanges._layoutChanged);

    this.totalAmountOfChange =
      this.changeListData.removed.length +
      this.changeListData.changed.length +
      this.changeListData.added.length +
      this.changeListData.layoutChanged.length;

    this.noChangesExisting = this.totalAmountOfChange === 0;

    if (this.noChangesExisting) {
      this.setNoChangesReason();
    } else {
      this.noChangesReason = '';
    }
  }

  private setNoChangesReason(): void {
    /*
     * This Regex removes all newlines and spaces to make sure that both xml
     * are not formatted.
     */
    const whitespaceAndNewLineRegex: RegExp = /\r?\n|\r|\s/g;

    const unformattedXml: string = this.currentXml.replace(whitespaceAndNewLineRegex, '');
    const unformattedSaveXml: string = this.previousXml.replace(whitespaceAndNewLineRegex, '');

    const diagramIsUnchanged: boolean = unformattedSaveXml === unformattedXml;

    if (diagramIsUnchanged) {
      this.noChangesReason = 'The two diagrams are identical.';
    } else {
      this.noChangesReason = 'The two diagrams are incomparable.';
    }
  }

  private createChangeListEntry(elementName: string, elementType: string): IChangeListEntry {
    const humanReadableElementName: string = this.elementNameService.getHumanReadableName(elementName);
    const humanReadableElementType: string = this.elementNameService.getHumanReadableType(elementType);

    const changeListEntry: IChangeListEntry = {
      name: humanReadableElementName,
      type: humanReadableElementType,
    };

    return changeListEntry;
  }

  private startSynchronizingViewers(): void {
    const lowerCanvas: ICanvas = this.lowerViewer.get('canvas');
    const leftCanvas: ICanvas = this.leftViewer.get('canvas');
    const rightCanvas: ICanvas = this.rightViewer.get('canvas');

    this.setEventFunctions(lowerCanvas, leftCanvas, rightCanvas);
    this.setEventFunctions(leftCanvas, rightCanvas, lowerCanvas);
    this.setEventFunctions(rightCanvas, lowerCanvas, leftCanvas);
  }

  private setEventFunctions(changingCanvas: ICanvas, firstCanvas: ICanvas, secondCanvas: ICanvas): void {
    const changingCanvasContainer: HTMLElement = changingCanvas._container;

    const adjustViewboxes: IEventFunction = (): void => {
      const changedViewbox: IViewbox = changingCanvas.viewbox();
      firstCanvas.viewbox(changedViewbox);
      secondCanvas.viewbox(changedViewbox);
    };

    const startCheckingForMouseMovement: IEventFunction = (): void => {
      window.onmousemove = adjustViewboxes;
    };
    const stopCheckingForMousemovement: IEventFunction = (): void => {
      window.onmousemove = null;
    };

    changingCanvasContainer.onwheel = adjustViewboxes;
    changingCanvasContainer.onmousedown = startCheckingForMouseMovement;
    changingCanvasContainer.onmouseup = stopCheckingForMousemovement;
  }

  private markAddedElements(addedElements: IDiffElementList): void {
    const elementsToBeColored: Array<IShape> = this.getElementsToBeColored(addedElements);

    this.colorizeElements(elementsToBeColored, defaultBpmnColors.green);
  }

  private markRemovedElements(deletedElements: IDiffElementList): void {
    const elementsToBeColored: Array<IShape> = this.getElementsToBeColored(deletedElements);

    this.colorizeElements(elementsToBeColored, defaultBpmnColors.red);
  }

  private markElementsWithLayoutChanges(elementsWithLayoutChanges: IDiffElementList): void {
    const elementsToBeColored: Array<IShape> = this.getElementsToBeColored(elementsWithLayoutChanges);

    this.colorizeElements(elementsToBeColored, defaultBpmnColors.purple);
  }

  private markChangedElements(changedElements: IChangedElementList): void {
    const changedElementsWithChanges: IChangedElementList = this.removeElementsWithoutChanges(changedElements);

    const elementsToBeColored: Array<IShape> = this.getChangedElementsToBeColored(changedElementsWithChanges);

    this.colorizeElements(elementsToBeColored, defaultBpmnColors.orange);
  }

  /*
   * This function removes all elements without any changes from the changedElement object
   * and returns an object without these elements.
   *
   *  This is needed because the diff function always adds the start event
   *  to the changed Elements even though it has no changes.
   *
   * @param changedElement The _changed object of the object that gets returned by the bpmn-differ.
   * @returns The same object without the elements that did not get changed.
   */
  private removeElementsWithoutChanges(changedElements: IChangedElementList): IChangedElementList {
    const copyOfChangedElements: IChangedElementList = Object.assign({}, changedElements);

    Object.keys(copyOfChangedElements).forEach((element: string) => {
      const currentElementHasNoChanges: boolean = Object.keys(copyOfChangedElements[element].attrs).length === 0;

      if (currentElementHasNoChanges) {
        delete copyOfChangedElements[element];
      }
    });

    return copyOfChangedElements;
  }

  private updateDiffView(): void {
    if (this.diffModeIsNewVsOld) {
      this.updateLowerDiff(this.currentXml);
    } else if (this.diffModeIsOldVsNew) {
      this.updateLowerDiff(this.previousXml);
    }
  }

  private async updateLowerDiff(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;

    if (xmlIsNotLoaded) {
      const notificationMessage: string =
        'The xml could not be loaded. Please try to reopen the Diff View or reload the Detail View.';
      this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    const addedElements: IDiffElementList = this.xmlChanges._added;
    const removedElements: IDiffElementList = this.xmlChanges._removed;
    const changedElements: IChangedElementList = this.xmlChanges._changed;
    const layoutChangedElements: IDiffElementList = this.xmlChanges._layoutChanged;

    const diffModeIsCurrentVsPrevious: boolean = this.currentDiffMode === DiffMode.NewVsOld;

    await this.importXml(xml, this.diffModeler);
    this.clearColors();

    this.markElementsWithLayoutChanges(layoutChangedElements);
    this.markChangedElements(changedElements);

    if (diffModeIsCurrentVsPrevious) {
      this.markAddedElements(addedElements);
    } else {
      this.markRemovedElements(removedElements);
    }

    const coloredXml: string = await this.exportXml(this.diffModeler);

    await this.importXml(coloredXml, this.lowerViewer);
  }

  private async importXml(xml: string, viewer: IBpmnModeler): Promise<void> {
    const xmlIsNotLoaded: boolean = xml === undefined || xml === null;
    if (xmlIsNotLoaded) {
      const notificationMessage: string =
        'The xml could not be loaded. Please try to reopen the Diff View or reload the Detail View.';
      this.notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    await viewer.importXML(xml);
    this.fitDiagramToViewport(viewer);
  }

  private fitDiagramToViewport(viewer: IBpmnModeler): void {
    const canvas: ICanvas = viewer.get('canvas');
    const viewbox: IViewbox = canvas.viewbox();
    const diagramIsVisible: boolean = viewbox.height > 0 && viewbox.width > 0;

    if (diagramIsVisible) {
      canvas.zoom('fit-viewport', 'auto');
    }
  }

  private async exportXml(modeler: IBpmnModeler): Promise<string> {
    const xmlSaveOptions: IBpmnXmlSaveOptions = {
      format: true,
    };

    const {xml} = await modeler.saveXML(xmlSaveOptions);

    return xml;
  }

  private createNewViewer(): IBpmnModeler {
    return new bundle.viewer({
      additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule],
    });
  }

  private getChangedElementsToBeColored(changedElementList: IChangedElementList): Array<IShape> {
    return Object.values(changedElementList)
      .filter((element: IChangedElement) => {
        return element.model.$type !== 'bpmn:Collaboration' && element.model.$type !== 'bpmn:Process';
      })
      .map((element: IChangedElement) => {
        const currentElement: IShape = this.elementRegistry.get(element.model.id);

        return currentElement;
      });
  }

  private getElementsToBeColored(elements: IDiffElementList): Array<IShape> {
    return Object.values(elements)
      .filter((element: IModdleElement) => {
        return element.$type !== 'bpmn:Collaboration' && element.$type !== 'bpmn:Process';
      })
      .map((element: IModdleElement) => {
        const currentElement: IShape = this.elementRegistry.get(element.id);

        return currentElement;
      });
  }

  private clearColors(): void {
    const elementsToBeColored: Array<IShape> = this.elementRegistry.filter((element: IShape): boolean => {
      const elementHasFillColor: boolean = element.businessObject.di.fill !== undefined;
      const elementHasBorderColor: boolean = element.businessObject.di.stroke !== undefined;

      const elementHasColor: boolean = elementHasFillColor || elementHasBorderColor;

      return elementHasColor;
    });

    this.colorizeElements(elementsToBeColored, defaultBpmnColors.none);
  }

  private colorizeElements(elementsToBeColored: Array<IShape>, color: IColorPickerColor): void {
    const noElementsToBeColored: boolean = elementsToBeColored.length === 0;

    if (noElementsToBeColored) {
      return;
    }

    this.modeling.setColor(elementsToBeColored, {
      stroke: color.border,
      fill: color.fill,
    });
  }
}
