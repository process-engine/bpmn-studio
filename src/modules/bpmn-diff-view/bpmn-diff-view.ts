import {inject} from 'aurelia-dependency-injection';
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable} from 'aurelia-framework';

import * as bundle from '@process-engine/bpmn-js-custom-bundle';

import {defaultBpmnColors,
  DiffMode,
  IBpmnModeler,
  ICanvas,
  IChangeListEntry,
  IColorPickerColor,
  IDiffChangeListData,
  IDiffChanges,
  IElementChange,
  IElementRegistry,
  IEventFunction,
  IModeling,
  IShape,
  NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {ElementNameService} from '../elementname/elementname.service';
import {NotificationService} from '../notification/notification.service';

@inject('NotificationService', EventAggregator)
export class BpmnDiffView {

  @bindable() public xml: string;
  @bindable({ changeHandler: 'savedXmlChanged' }) public savedxml: string;
  @bindable() public changes: IDiffChanges;
  public leftCanvasModel: HTMLElement;
  public rightCanvasModel: HTMLElement;
  public lowerCanvasModel: HTMLElement;
  public currentDiffMode: DiffMode;
  public diffModeTitle: string = '';
  public showChangeList: boolean;
  public noChangesExisting: boolean = true;
  public noChangesReason: string;
  public totalAmountOfChange: number;
  public changeListData: IDiffChangeListData = {
    removed: [],
    changed: [],
    added: [],
    layoutChanged: [],
  };

  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _leftViewer: IBpmnModeler;
  private _rightViewer: IBpmnModeler;
  private _lowerViewer: IBpmnModeler;
  private _diffModeler: IBpmnModeler;
  private _modeling: IModeling;
  private _elementRegistry: IElementRegistry;
  private _subscriptions: Array<Subscription>;
  private _elementNameService: ElementNameService;

  constructor(notificationService: NotificationService, eventAggregator: EventAggregator) {
    this._notificationService = notificationService;
    this._eventAggregator = eventAggregator;
    this._elementNameService = new ElementNameService();
  }

  public created(): void {
    this._leftViewer = this._createNewViewer();
    this._rightViewer = this._createNewViewer();
    this._lowerViewer = this._createNewViewer();

    this._diffModeler = new bundle.modeler();

    this._modeling = this._diffModeler.get('modeling');
    this._elementRegistry = this._diffModeler.get('elementRegistry');

    this._startSynchronizingViewers();
  }

  public attached(): void {
    this._leftViewer.attachTo(this.leftCanvasModel);
    this._rightViewer.attachTo(this.rightCanvasModel);
    this._lowerViewer.attachTo(this.lowerCanvasModel);

    this._syncAllViewers();

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.diffView.changeDiffMode, (diffMode: DiffMode) => {
        this.currentDiffMode = diffMode;
        this._updateDiffView();
      }),

      this._eventAggregator.subscribe(environment.events.diffView.toggleChangeList, () => {
        this.showChangeList = !this.showChangeList;
      }),
    ];

    this.currentDiffMode = DiffMode.AfterVsBefore;
    this._updateDiffView();
  }

  public detached(): void {
    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  public xmlChanged(): void {
    this._importXml(this.xml, this._rightViewer);
  }

  public savedXmlChanged(): void {
    this._importXml(this.savedxml, this._leftViewer);
  }

  public changesChanged(): void {
    this._updateDiffView();
    this._prepareChangesForChangeList();
  }

  private _syncAllViewers(): void {
    const lowerCanvas: ICanvas = this._lowerViewer.get('canvas');
    const leftCanvas: ICanvas = this._leftViewer.get('canvas');
    const rightCanvas: ICanvas = this._rightViewer.get('canvas');

    const changedViewbox: string = lowerCanvas.viewbox();
    leftCanvas.viewbox(changedViewbox);
    rightCanvas.viewbox(changedViewbox);
  }

  private _getChangeListEntriesFromChanges(elementChanges: object): Array<IChangeListEntry> {
    const changeListEntries: Array<IChangeListEntry> = [];
    const elementIds: Array<string> = Object.keys(elementChanges);

    for (const elementId of elementIds) {
      const elementChange: IElementChange = elementChanges[elementId];

      const isTypeInModel: boolean = elementChange.$type === undefined;
      const changeListEntry: IChangeListEntry = isTypeInModel ?
         this._createChangeListEntry(elementChange.model.name, elementChange.model.$type) :
         this._createChangeListEntry(elementChange.name, elementChange.$type);

      changeListEntries.push(changeListEntry);
    }

    return changeListEntries;
  }

  /*
  * This function converts the object from the bpmn-differ into an object with arrays
  * to make it loopable in the html.
  */
  private _prepareChangesForChangeList(): void {
    this.changeListData.removed = [];
    this.changeListData.changed = [];
    this.changeListData.added = [];
    this.changeListData.layoutChanged = [];

    const changedElement: object = this._removeElementsWithoutChanges(this.changes._changed);

    this.changeListData.removed = this._getChangeListEntriesFromChanges(this.changes._removed);
    this.changeListData.changed = this._getChangeListEntriesFromChanges(changedElement);
    this.changeListData.added = this._getChangeListEntriesFromChanges(this.changes._added);
    this.changeListData.layoutChanged = this._getChangeListEntriesFromChanges(this.changes._layoutChanged);

    this.totalAmountOfChange = this.changeListData.removed.length +
                                this.changeListData.changed.length +
                                this.changeListData.added.length +
                                this.changeListData.layoutChanged.length;

    this.noChangesExisting = this.totalAmountOfChange === 0;

    if (this.noChangesExisting) {
      this._setNoChangesReason();
    } else {
      this.noChangesReason = '';
    }
  }

  private _setNoChangesReason(): void {

    /*
    * This Regex removes all newlines and spaces to make sure that both xml
    * are not formatted.
    */
    const whitespaceAndNewLineRegex: RegExp = /\r?\n|\r|\s/g;

    const unformattedXml: string = this.xml.replace(whitespaceAndNewLineRegex, '');
    const unformattedSaveXml: string = this.savedxml.replace(whitespaceAndNewLineRegex, '');

    const diagramIsUnchanged: boolean = unformattedSaveXml === unformattedXml;

    if (diagramIsUnchanged) {
        this.noChangesReason = 'The two diagrams are identical.';
      } else {
        this.noChangesReason = 'The two diagrams are incomparable.';
      }
  }

  private _createChangeListEntry(elementName: string, elementType: string): IChangeListEntry {
    const humanReadableElementName: string = this._elementNameService.getHumanReadableName(elementName);
    const humanReadableElementType: string = this._elementNameService.getHumanReadableType(elementType);

    const changeListEntry: IChangeListEntry = {
      name: humanReadableElementName,
      type: humanReadableElementType,
    };

    return changeListEntry;
  }

  private _markAddedElements(addedElements: object): void {
    const elementsToColor: Array<IShape> = this._getElementsToColor(addedElements);

    this._colorElements(elementsToColor, defaultBpmnColors.green);
  }

  private _markRemovedElements(deletedElements: object): void {
    const elementsToColor: Array<IShape> = this._getElementsToColor(deletedElements);

    this._colorElements(elementsToColor, defaultBpmnColors.red);
  }

  private _startSynchronizingViewers(): void {
    const lowerCanvas: ICanvas = this._lowerViewer.get('canvas');
    const leftCanvas: ICanvas = this._leftViewer.get('canvas');
    const rightCanvas: ICanvas = this._rightViewer.get('canvas');

    this._setEventFunctions(lowerCanvas, leftCanvas, rightCanvas);
    this._setEventFunctions(leftCanvas, rightCanvas, lowerCanvas);
    this._setEventFunctions(rightCanvas, lowerCanvas, leftCanvas);
  }

  private _setEventFunctions(changingCanvas: ICanvas, firstCanvas: ICanvas, secondCanvas: ICanvas): void {
    const changingCanvasContainer: HTMLElement = changingCanvas._container;

    const adjustViewboxes: IEventFunction = (): void => {
      const changedViewbox: string = changingCanvas.viewbox();
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

  private _markLayoutChangedElements(layoutChangedElements: object): void {
    const elementsToColor: Array<IShape> = this._getElementsToColor(layoutChangedElements);

    this._colorElements(elementsToColor, defaultBpmnColors.purple);
  }

  private _markChangedElements(changedElements: object): void {
    const changedElementsWithChanges: object = this._removeElementsWithoutChanges(changedElements);

    const elementsToColor: Array<IShape> = this._getElementsToColor(changedElementsWithChanges);

    this._colorElements(elementsToColor, defaultBpmnColors.orange);
  }

  /*
  * This function removes all elements without any changes from the changedElement object
  * and returns an object without these elements.
  *
  *  This is needed because the diff function always adds the start event
  *  to the changed Elements even though it has no changes.
  *
  * @param changedElement The _changed object of the object that gets returned by the bpmn-differ.
  * @returns The same object without the elements that did not get chnaged.
  */
  private _removeElementsWithoutChanges(changedElements: object): object {
    for (const elementId in changedElements) {
      const currentElementHasNoChanges: boolean = Object.keys(changedElements[elementId].attrs).length === 0;

      if (currentElementHasNoChanges) {
        delete changedElements[elementId];
      }
    }

    return changedElements;
  }

  private _updateDiffView(): void {
    if (this.currentDiffMode === DiffMode.AfterVsBefore) {
      this._updateLowerDiff(this.xml);
      this.diffModeTitle = 'After vs. Before';
    } else if (this.currentDiffMode === DiffMode.BeforeVsAfter) {
      this._updateLowerDiff(this.savedxml);
      this.diffModeTitle = 'Before vs. After';
    } else {
      this.diffModeTitle = '';
    }
  }

  private async _updateLowerDiff(xml: string): Promise<void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const notificationMessage: string = 'The xml could not be loaded. Please try to reopen the Diff View or reload the Detail View.';
      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    const addedElements: Object = this.changes._added;
    const removedElements: object = this.changes._removed;
    const changedElements: object = this.changes._changed;
    const layoutChangedElements: object = this.changes._layoutChanged;

    const diffModeIsAfterVsBefore: boolean = this.currentDiffMode === DiffMode.AfterVsBefore;

    await this._importXml(xml, this._diffModeler);
    this._clearColors();

    this._markLayoutChangedElements(layoutChangedElements);
    this._markChangedElements(changedElements);

    if (diffModeIsAfterVsBefore) {
      this._markAddedElements(addedElements);
    } else {
      this._markRemovedElements(removedElements);
    }

    const coloredXml: string = await this._getXmlFromModeler();
    await this._importXml(coloredXml, this._lowerViewer);
  }

  private async _importXml(xml: string, viewer: IBpmnModeler): Promise <void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const notificationMessage: string = 'The xml could not be loaded. Please try to reopen the Diff View or reload the Detail View.';
      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      viewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }

        resolve();
      });
    });

    return xmlImportPromise;
  }

  private async _getXmlFromModeler(): Promise<string> {
    const saveXmlPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void =>  {
      this._diffModeler.saveXML({}, async(saveXmlError: Error, xml: string) => {
        if (saveXmlError) {
          reject(saveXmlError);

          return;
        }

        resolve(xml);
      });
    });

    return saveXmlPromise;
  }

  private _createNewViewer(): IBpmnModeler {
    return new bundle.viewer({
      additionalModules:
      [
        bundle.ZoomScrollModule,
        bundle.MoveCanvasModule,
      ],
    });
  }

  private _getElementsToColor(elements: object): Array<IShape> {
    const elementsToColor: Array<IShape> = [];

    for (const elementId in elements) {
      const currentElement: IShape = this._elementRegistry.get(elementId);

      elementsToColor.push(currentElement);
    }

    return elementsToColor;
  }

  private _clearColors(): void {
    const elementsToColor: Array<IShape> = this._elementRegistry.filter((element: IShape): boolean => {
      const elementHasFillColor: boolean = element.businessObject.di.fill !== undefined;
      const elementHasBorderColor: boolean = element.businessObject.di.stroke !== undefined;

      const elementHasColor: boolean = elementHasFillColor || elementHasBorderColor;

      return elementHasColor;
    });

    this._colorElements(elementsToColor, defaultBpmnColors.none);
  }

  private _colorElements(elementsToColor: Array<IShape>, color: IColorPickerColor): void {
    const noElementsToColorize: boolean = elementsToColor.length === 0;

    if (noElementsToColorize) {
      return;
    }

    this._modeling.setColor(elementsToColor, {
      stroke: color.border,
      fill: color.fill,
    });
  }
}
