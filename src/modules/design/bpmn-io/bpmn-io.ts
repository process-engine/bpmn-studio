/* eslint-disable max-lines */
/* eslint-disable 6river/new-cap */
/* eslint-disable no-underscore-dangle */
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, bindingMode, inject, observable} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import * as bpmnlintConfig from '@process-engine/bpmn-lint_rules';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {
  IBpmnModeler,
  IBpmnXmlSaveOptions,
  ICanvas,
  IDiagramExportService,
  IDiagramPrintService,
  IDiagramState,
  IEditorActions,
  IElementRegistry,
  IEvent,
  IEventFunction,
  IInternalEvent,
  IKeyboard,
  ILinting,
  ISolutionService,
  IValidateIssue,
  IValidateIssueCategory,
  IValidateResult,
  IViewbox,
  NotificationType,
} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../../services/notification-service/notification.service';
import {OpenDiagramStateService} from '../../../services/solution-explorer-services/open-diagram-state.service';
import {PropertyPanel} from '../property-panel/property-panel';
import {DiagramExportService, DiagramPrintService} from './services/index';
import {UserConfigService} from '../../../services/user-config-service/user-config.service';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {isRunningInElectron} from '../../../services/is-running-in-electron-module/is-running-in-electron.module';

const sideBarRightSize: number = 35;

@inject('NotificationService', EventAggregator, 'OpenDiagramStateService', 'SolutionService', 'UserConfigService')
export class BpmnIo {
  @bindable public propertyPanelViewModel: PropertyPanel;
  public modeler: IBpmnModeler;
  public viewer: IBpmnModeler;

  public resizeButton: HTMLButtonElement;
  public canvasModel: HTMLDivElement;
  public propertyPanel: HTMLElement;
  @bindable({changeHandler: 'diagramChanged'}) public diagramUri: string;
  @bindable({defaultBindingMode: bindingMode.twoWay}) public xml: string;
  @bindable({changeHandler: 'nameChanged'}) public name: string;
  @observable public propertyPanelWidth: number;
  public showLinter: boolean;
  public solutionIsRemote: boolean = false;
  public savedXml: string;
  public showPropertyPanel: boolean = false;
  public colorPickerLoaded: boolean = false;
  public minCanvasWidth: number = 100;
  public minPropertyPanelWidth: number = 200;
  public diagramIsInvalid: boolean = false;
  public diagramHasChanged: boolean = false;
  public saveStateForNewUri: boolean = false;
  public linterIsActive: boolean = true;

  private bpmnLintButton: HTMLElement;
  private linting: ILinting;
  private diagramConverter: IBpmnModeler;

  private propertyPanelShouldOpen: boolean = false;
  private propertyPanelHiddenForSpaceReasons: boolean = false;
  private propertyPanelHasNoSpace: boolean = false;

  private notificationService: NotificationService;
  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;
  private diagramExportService: IDiagramExportService;
  private diagramPrintService: IDiagramPrintService;
  private openDiagramStateService: OpenDiagramStateService;
  private solutionService: ISolutionService;
  private userConfigService: UserConfigService;

  constructor(
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    openDiagramStateService: OpenDiagramStateService,
    solutionService: ISolutionService,
    userConfigService: UserConfigService,
  ) {
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.openDiagramStateService = openDiagramStateService;
    this.solutionService = solutionService;
    this.userConfigService = userConfigService;
  }

  public created(): void {
    this.modeler = new bundle.modeler({
      additionalModules: [
        bundle.MiniMap,
        bundle.ZoomScrollModule,
        bundle.MoveCanvasModule,
        bundle.resizeAllModule,
        bundle.lintModule,
      ],
      linting: {
        bpmnlint: bpmnlintConfig,
      },
      moddleExtensions: {
        camunda: bundle.camundaModdleDescriptor,
      },
      keyboard: {
        bindTo: document,
      },
    });

    this.diagramConverter = new bundle.modeler({
      moddleExtensions: {
        camunda: bundle.camundaModdleDescriptor,
      },
    });

    this.linting = this.modeler.get('linting');

    this.addRemoveWithBackspaceKeyboardListener();

    /**
     * Subscribe to "commandStack.changed"-event to have a simple indicator of
     * when a diagram is changed.
     */
    const handlerPriority: number = 1000;

    this.modeler.on(
      'commandStack.changed',
      async () => {
        if (!this.solutionIsRemote) {
          this.eventAggregator.publish(environment.events.diagramChange);
        }

        this.xml = await this.getXML();
      },
      handlerPriority,
    );

    this.modeler.on('contextPad.create', (event: IInternalEvent) => {
      if (this.solutionIsRemote) {
        return;
      }

      const elementIsNoParticipant: boolean = event.element.type !== 'bpmn:Participant';
      if (elementIsNoParticipant) {
        return;
      }

      setTimeout(() => {
        const contextPadWrench: Element = document.querySelector('.bpmn-icon-screw-wrench');
        contextPadWrench.parentNode.removeChild(contextPadWrench);
      }, 0);
    });

    this.modeler.on(
      'import.done',
      () => {
        this.fitDiagramToViewport();

        if (!this.solutionIsRemote) {
          this.validateDiagram();
          this.linting.update();
        }
      },
      1,
    );

    this.diagramPrintService = new DiagramPrintService();
    this.diagramExportService = new DiagramExportService();
  }

  public async attached(): Promise<void> {
    this.linterIsActive = this.userConfigService.getUserConfig('design.activate_linter');

    if (this.diagramHasState(this.diagramUri)) {
      const diagramState: IDiagramState = this.loadDiagramState(this.diagramUri);

      await this.importXmlIntoModeler(diagramState.data.xml);
    } else {
      const xmlIsNotEmpty: boolean = this.xml !== undefined && this.xml !== null;

      if (xmlIsNotEmpty) {
        await this.importXmlIntoModeler(this.xml);

        this.savedXml = await this.convertXml(this.xml);
      }
    }

    // Wait until the HTML is rendered
    setTimeout(() => {
      this.bpmnLintButton = document.querySelector('.bpmn-js-bpmnlint-button');

      if (this.bpmnLintButton) {
        this.bpmnLintButton.style.display = 'none';
      }
    }, 0);

    if (this.solutionIsRemote) {
      await this.importXmlIntoViewer(this.xml);
      this.viewer.attachTo(this.canvasModel);
    } else {
      this.modeler.attachTo(this.canvasModel);

      this.movePaletteToLeftToolbar();
    }

    window.addEventListener('resize', this.resizeEventHandler);

    this.resizeButton.addEventListener('mousedown', (e: Event) => {
      const windowEvent: Event = e || window.event;
      windowEvent.cancelBubble = true;

      const mousemoveFunction: IEventFunction = (event: MouseEvent): void => {
        this.resize(event);
        document.getSelection().empty();
      };

      const mouseUpFunction: IEventFunction = (): void => {
        document.removeEventListener('mousemove', mousemoveFunction);
        document.removeEventListener('mouseup', mouseUpFunction);
      };

      document.addEventListener('mousemove', mousemoveFunction);
      document.addEventListener('mouseup', mouseUpFunction);
    });

    document.addEventListener('keydown', this.printHotkeyEventHandler);

    if (!isRunningInElectron()) {
      document.addEventListener('keydown', this.saveHotkeyEventHandler);
    }

    this.hideOrShowPpForSpaceReasons();

    this.subscriptions = [
      this.eventAggregator.subscribe(
        environment.events.solutionExplorerPanel.toggleSolutionExplorer,
        (showSolutionExplorer: boolean) => {
          if (!this.solutionIsRemote) {
            this.setDjsPaletteLeftStyle(showSolutionExplorer);
          }

          setTimeout(() => {
            this.hideOrShowPpForSpaceReasons();
          }, 0);
        },
      ),

      this.eventAggregator.subscribe(environment.events.diagramNeedsToBeUpdated, async () => {
        this.diagramHasChanged = true;
        const diagramState: IDiagramState | null = this.openDiagramStateService.loadDiagramState(this.diagramUri);

        const newXml = diagramState.data.xml;

        await this.importXmlIntoModeler(newXml);

        this.savedXml = newXml;
        this.xml = newXml;
      }),

      this.eventAggregator.subscribe(`${environment.events.diagramDetail.exportDiagramAs}:BPMN`, async () => {
        try {
          const exportName: string = `${this.name}.bpmn`;
          const xmlToExport: string = await this.getXML();

          await this.diagramExportService
            .loadXML(xmlToExport)
            .asBpmn()
            .export(exportName);
        } catch {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.diagramDetail.exportDiagramAs}:SVG`, async () => {
        try {
          const exportName: string = `${this.name}.svg`;
          await this.diagramExportService
            .loadSVG(await this.getSVG())
            .asSVG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.diagramDetail.exportDiagramAs}:PNG`, async () => {
        try {
          const exportName: string = `${this.name}.png`;
          await this.diagramExportService
            .loadSVG(await this.getSVG())
            .asPNG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.diagramDetail.exportDiagramAs}:JPEG`, async () => {
        try {
          const exportName: string = `${this.name}.jpeg`;
          await this.diagramExportService
            .loadSVG(await this.getSVG())
            .asJPEG()
            .export(exportName);
        } catch (error) {
          this.notificationService.showNotification(
            NotificationType.ERROR,
            'An error occurred while preparing the diagram for exporting',
          );
        }
      }),

      this.eventAggregator.subscribe(`${environment.events.diagramDetail.printDiagram}`, async () => {
        await this.printHandler();
      }),

      this.eventAggregator.subscribe(environment.events.diagramDetail.saveDiagram, async () => {
        this.savedXml = await this.getXML();
      }),

      this.eventAggregator.subscribe(environment.events.diagramChange, async () => {
        this.xml = await this.getXML();

        const diagramIsChanged: boolean = !this.areXmlsIdentical(this.xml, this.savedXml);

        this.validateDiagram();

        this.eventAggregator.publish(environment.events.differsFromOriginal, diagramIsChanged);
      }),

      this.eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.diagramIsInvalid = true;
      }),

      this.eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.diagramIsInvalid = false;
      }),

      this.eventAggregator.subscribe(environment.events.bpmnio.togglePropertyPanel, () => {
        this.togglePanel();
      }),

      this.eventAggregator.subscribe(environment.events.bpmnio.bindKeyboard, () => {
        const keyboard: IKeyboard = this.modeler.get('keyboard');

        const element: Document | any = document;
        keyboard.bind(element);
      }),

      this.eventAggregator.subscribe(environment.events.bpmnio.unbindKeyboard, () => {
        const keyboard: IKeyboard = this.modeler.get('keyboard');

        keyboard.unbind();
      }),

      this.eventAggregator.subscribe(environment.events.bpmnio.fitViewport, () => {
        setTimeout(() => {
          this.fitDiagramToViewport(true);
        }, 0);
      }),
    ];

    const previousPropertyPanelWidth: string = window.localStorage.getItem('propertyPanelWidth');

    /*
     * Update the property panel width;
     * if no previous width was found, take the configured one.
     */
    this.propertyPanelWidth =
      previousPropertyPanelWidth !== undefined
        ? parseInt(previousPropertyPanelWidth)
        : environment.propertyPanel.defaultWidth;

    const propertyPanelHideState: string = window.localStorage.getItem('propertyPanelHideState');
    const wasPropertyPanelVisible: boolean = propertyPanelHideState === null || propertyPanelHideState === 'show';
    this.propertyPanelShouldOpen = wasPropertyPanelVisible;
    this.togglePanel();

    this.updateViewboxStateOnChange();
  }

  public detached(): void {
    this.modeler.detach();
    this.modeler.destroy();

    this.diagramConverter.destroy();

    const viewerIsInitialized: boolean = this.viewer !== undefined;
    if (viewerIsInitialized) {
      this.viewer.destroy();
      this.viewer.detach();
    }

    window.removeEventListener('resize', this.resizeEventHandler);
    document.removeEventListener('keydown', this.printHotkeyEventHandler);

    if (!isRunningInElectron()) {
      document.removeEventListener('keydown', this.saveHotkeyEventHandler);
    }

    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public movePaletteToLeftToolbar(): void {
    const bpmnIoPaletteContainer: Element = this.canvasModel.getElementsByClassName('djs-palette')[0];

    if (bpmnIoPaletteContainer.className.includes('djs-palette-override')) {
      return;
    }

    bpmnIoPaletteContainer.className += ' djs-palette-override';

    if (!this.solutionIsRemote) {
      const showSolutionExplorer: boolean = localStorage.getItem('SolutionExplorerVisibility') !== 'false';
      this.setDjsPaletteLeftStyle(showSolutionExplorer);
    }
  }

  public async saveCurrentXML(): Promise<void> {
    this.savedXml = await this.getXML();
  }

  public async xmlChanged(newValue: string, oldValue?: string): Promise<void> {
    if (this.diagramHasChanged) {
      this.savedXml = await this.convertXml(newValue);

      if (this.solutionIsRemote) {
        await this.importXmlIntoViewer(this.xml);
      }

      if (this.diagramHasState(this.diagramUri)) {
        await this.recoverDiagramState();
      } else {
        await this.importXmlIntoModeler(this.xml);
      }

      this.propertyPanelViewModel.xmlWasChanged();

      const diagramState: IDiagramState = this.loadDiagramState(this.diagramUri);
      const diagramContainsChanges: boolean = diagramState !== null && diagramState.metadata.isChanged;

      this.eventAggregator.publish(environment.events.differsFromOriginal, diagramContainsChanges);
    }

    const oldValueExists: boolean = oldValue !== undefined;
    if (!this.diagramHasChanged && oldValueExists && !this.solutionIsRemote) {
      this.saveDiagramState(this.diagramUri);
    }

    this.diagramHasChanged = false;
  }

  public async diagramChanged(newUri: string, previousUri: string): Promise<void> {
    this.diagramHasChanged = true;

    const previousDiagramExists: boolean = previousUri !== undefined;
    if (!this.solutionIsRemote && previousDiagramExists) {
      if (this.saveStateForNewUri) {
        this.saveStateForNewUri = false;

        const previousDiagramWasNoNewDiagram: boolean = !previousUri.startsWith('about:open-diagrams');
        if (previousDiagramWasNoNewDiagram) {
          await this.saveDiagramState(newUri);
        }
      } else {
        const previousDiagramIsNotDeleted: boolean = this.solutionService
          .getOpenDiagrams()
          .some((diagram: IDiagram) => diagram.uri === previousUri);

        if (previousDiagramIsNotDeleted) {
          await this.saveDiagramState(previousUri);
        }
      }
    }

    this.solutionIsRemote = solutionIsRemoteSolution(this.diagramUri);
    if (this.solutionIsRemote) {
      const viewerNotInitialized: boolean = this.viewer === undefined;
      if (viewerNotInitialized) {
        this.viewer = new bundle.viewer({
          additionalModules: [bundle.ZoomScrollModule, bundle.MoveCanvasModule, bundle.MiniMap],
        });

        this.viewer.on('selection.changed', (event: IEvent) => {
          const nothingIsSelected: boolean = event.newSelection.length === 0;
          if (nothingIsSelected) {
            return;
          }

          const selectedElement: IShape = event.newSelection[0];
          const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
          const modelerShape: IShape = elementRegistry.get(selectedElement.id);

          this.modeler.get('selection').select(modelerShape);
        });

        this.viewer.on('import.done', () => {
          this.fitDiagramToViewport();
        });
      }

      const xmlExists: boolean = this.xml !== undefined;
      if (xmlExists) {
        this.xmlChanged(this.xml);
        this.propertyPanelViewModel.selectPreviouslySelectedOrFirstElement();
      }

      setTimeout(async () => {
        this.viewer.attachTo(this.canvasModel);

        const xmlIsNotEmpty: boolean = this.xml !== undefined && this.xml !== null;
        if (xmlIsNotEmpty) {
          await this.importXmlIntoViewer(this.xml);
        }

        this.linting.deactivateLinting();
      }, 0);
    } else {
      setTimeout(() => {
        this.modeler.attachTo(this.canvasModel);

        const xmlExists: boolean = this.xml !== undefined;
        if (xmlExists) {
          this.xmlChanged(this.xml);
          this.propertyPanelViewModel.selectPreviouslySelectedOrFirstElement();
        }

        this.movePaletteToLeftToolbar();
        this.bpmnLintButton = document.querySelector('.bpmn-js-bpmnlint-button');

        if (this.bpmnLintButton) {
          this.bpmnLintButton.style.display = 'none';
        }
      }, 0);
    }
  }

  public nameChanged(newValue: string): void {
    if (this.modeler !== undefined && this.modeler !== null) {
      this.name = newValue;
    }
  }

  public propertyPanelWidthChanged(newValue: number): void {
    if (newValue !== undefined) {
      window.localStorage.setItem('propertyPanelWidth', `${this.propertyPanelWidth}`);
    }
  }

  private diagramHasState(uri: string): boolean {
    const diagramState: IDiagramState = this.loadDiagramState(uri);

    return diagramState !== null;
  }

  private loadDiagramState(diagramUri: string): IDiagramState {
    return this.openDiagramStateService.loadDiagramState(diagramUri);
  }

  private async recoverDiagramState(): Promise<void> {
    const diagramState: IDiagramState = this.loadDiagramState(this.diagramUri);

    const diagramHasNoState: boolean = diagramState === null;
    if (diagramHasNoState) {
      return;
    }

    const xml: string = diagramState.data.xml;
    await this.importXmlIntoModeler(xml);

    this.fitDiagramToViewport();
  }

  private async validateDiagram(): Promise<void> {
    if (!this.linterIsActive) {
      return;
    }

    const validationResult: IValidateResult = await this.linting.lint();
    this.linting.update();

    let validationResultContainsErrors: boolean = false;

    Object.entries(validationResult).forEach(([key, validationIssues]: [string, Array<IValidateIssue>]) => {
      const issuesContainError: boolean = validationIssues.some((issue: IValidateIssue) => {
        return issue.category === IValidateIssueCategory.error;
      });

      if (issuesContainError) {
        validationResultContainsErrors = true;
      }
    });

    this.diagramIsInvalid = validationResultContainsErrors;
  }

  public togglePanel(): void {
    if (this.propertyPanelShouldOpen) {
      if (this.propertyPanelHasNoSpace) {
        this.notificationService.showNotification(
          NotificationType.ERROR,
          'There is not enough space for the property panel!',
        );
        return;
      }

      document.getElementById('toggleButtonPropertyPanel').classList.add('design-layout__tool--active');
      this.showPropertyPanel = true;
      this.eventAggregator.publish(environment.events.bpmnio.propertyPanelActive, true);
      this.propertyPanelShouldOpen = false;
      window.localStorage.setItem('propertyPanelHideState', 'show');
    } else {
      document.getElementById('toggleButtonPropertyPanel').classList.remove('design-layout__tool--active');
      this.showPropertyPanel = false;
      this.eventAggregator.publish(environment.events.bpmnio.propertyPanelActive, false);
      this.propertyPanelShouldOpen = true;
      window.localStorage.setItem('propertyPanelHideState', 'hide');
    }
  }

  public resize(event: MouseEvent): void {
    const mousePosition: number = event.clientX;

    this.setNewPropertyPanelWidthFromMousePosition(mousePosition);
  }

  public async getXML(): Promise<string> {
    const returnPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      const xmlSaveOptions: IBpmnXmlSaveOptions = {
        format: true,
      };

      this.modeler.saveXML(xmlSaveOptions, (error: Error, result: string) => {
        if (error) {
          reject(error);

          return;
        }

        resolve(result);
      });
    });

    return returnPromise;
  }

  public toggleLinter(): void {
    this.showLinter = !this.showLinter;
    this.bpmnLintButton = document.querySelector('.bpmn-js-bpmnlint-button');

    if (this.showLinter) {
      this.bpmnLintButton.style.display = 'block';

      this.linting.activateLinting();
    } else {
      this.bpmnLintButton.style.display = 'none';

      this.linting.deactivateLinting();
    }
  }

  public async saveDiagramState(diagramUri: string): Promise<void> {
    const savedXml: string = this.savedXml;
    const modelerCanvas: ICanvas = this.modeler.get('canvas');

    const isUnsavedDiagram: boolean = diagramUri.startsWith('about:open-diagrams');
    const currentViewbox: IViewbox = modelerCanvas.viewbox();
    const diagramIsVisible: boolean = currentViewbox.width > 0 && currentViewbox.height > 0;

    const xml: string = await this.getXML();
    const viewbox: IViewbox = diagramIsVisible ? currentViewbox : undefined;
    const selectedElements: Array<IShape> = this.modeler.get('selection')._selectedElements;
    const isChanged: boolean = isUnsavedDiagram || !this.areXmlsIdentical(xml, savedXml);

    const diagramState: IDiagramState | null = this.openDiagramStateService.loadDiagramState(diagramUri);
    const diagramStateExists: boolean = diagramState !== null;
    if (diagramStateExists) {
      diagramState.data.xml = xml;
      diagramState.metadata.selectedElements = selectedElements;
      diagramState.metadata.isChanged = isChanged;

      if (viewbox) {
        diagramState.metadata.location = viewbox;
      }

      this.openDiagramStateService.updateDiagramState(diagramUri, diagramState);
    } else {
      this.openDiagramStateService.saveDiagramState(diagramUri, xml, viewbox, selectedElements, isChanged);
    }
  }

  private updateViewboxStateOnChange(): void {
    this.modeler.on('canvas.viewbox.changed', () => {
      this.updateViewboxState();
    });
  }

  private updateViewboxState(): void {
    const modelerCanvas: ICanvas = this.modeler.get('canvas');
    const viewbox: IViewbox = modelerCanvas.viewbox();

    const diagramState: IDiagramState | null = this.openDiagramStateService.loadDiagramState(this.diagramUri);

    const diagramHasNoState: boolean = !this.diagramHasState(this.diagramUri);
    const diagramIsVisible: boolean = viewbox.width > 0 && viewbox.height > 0;
    if (!diagramIsVisible || diagramHasNoState) {
      return;
    }

    diagramState.metadata.location = viewbox;

    this.openDiagramStateService.updateDiagramState(this.diagramUri, diagramState);
  }

  private areXmlsIdentical(firstXml: string, secondXml: string): boolean {
    /*
     * This Regex removes all newlines and spaces to make sure that both xml
     * are not formatted.
     */
    const whitespaceAndNewLineRegex: RegExp = /\r?\n|\r|\s/g;

    const unformattedXml: string = firstXml.replace(whitespaceAndNewLineRegex, '');
    const unformattedSaveXml: string = secondXml.replace(whitespaceAndNewLineRegex, '');

    return unformattedSaveXml === unformattedXml;
  }

  private importXmlIntoModeler(xml: string): Promise<void> {
    return new Promise((resolve: Function, reject: Function): void => {
      this.modeler.importXML(xml, (error: Error) => {
        const errorOccured: boolean = error !== undefined;
        if (errorOccured) {
          reject();

          return;
        }

        resolve();
      });
    });
  }

  private importXmlIntoViewer(xml: string): Promise<void> {
    return new Promise((resolve: Function, reject: Function): void => {
      this.viewer.importXML(xml, (error: Error) => {
        const errorOccured: boolean = error !== undefined;
        if (errorOccured) {
          reject();

          return;
        }

        resolve();
      });
    });
  }

  private convertXml(xml: string): Promise<string> {
    return new Promise((resolve: Function, reject: Function): void => {
      this.diagramConverter.importXML(xml, (importError: Error) => {
        const importErrorOccured: boolean = importError !== undefined;
        if (importErrorOccured) {
          reject(importError);

          return;
        }

        this.diagramConverter.saveXML({format: true}, (exportError: Error, convertedXml: string) => {
          const exportErrorOccured: boolean = exportError !== undefined;
          if (exportErrorOccured) {
            reject(exportError);

            return;
          }

          resolve(convertedXml);
        });
      });
    });
  }

  private fitDiagramToViewport(force: boolean = false): void {
    const modelerCanvas: ICanvas = this.modeler.get('canvas');
    const modelerViewbox: IViewbox = modelerCanvas.viewbox();
    const modelerDiagramIsVisible: boolean = modelerViewbox.height > 0 && modelerViewbox.width > 0;

    if (this.solutionIsRemote) {
      const viewerCanvas: ICanvas = this.viewer.get('canvas');
      const viewerViewbox: IViewbox = viewerCanvas.viewbox();
      const viewerDiagramIsVisible: boolean = viewerViewbox.height > 0 && viewerViewbox.width > 0;

      if (viewerDiagramIsVisible || force) {
        viewerCanvas.zoom('fit-viewport', 'auto');
      }
    } else if (modelerDiagramIsVisible || force) {
      const diagramState: IDiagramState = this.loadDiagramState(this.diagramUri);

      const viewbox: IViewbox = diagramState.metadata.location;
      const viewboxIsSet: boolean = viewbox !== undefined;
      if (viewboxIsSet) {
        modelerCanvas.viewbox(viewbox);
      } else {
        modelerCanvas.zoom('fit-viewport', 'auto');
      }
    }
  }

  private setNewPropertyPanelWidthFromMousePosition(mousePosition: number): void {
    const propertyPanelMaxWidth: number = this.propertyPanel.parentElement.offsetWidth - this.minCanvasWidth;
    const mousePositionFromRight: number = document.body.clientWidth - mousePosition;
    const resizedWidth: number = mousePositionFromRight - sideBarRightSize;

    /*
     * This is needed to stop the width from increasing too far
     * the property panel would not be displayed with that width,
     * but when increasing the browser width, the property panel
     * then may also increase.
     */
    const newPropertyPanelWidth: number = Math.min(resizedWidth, propertyPanelMaxWidth);

    this.propertyPanelWidth = newPropertyPanelWidth;
  }

  private hidePropertyPanelForSpaceReasons(): void {
    this.propertyPanelHasNoSpace = true;
    const propertyPanelIsOpen: boolean = !this.propertyPanelShouldOpen;

    if (propertyPanelIsOpen) {
      this.propertyPanelHiddenForSpaceReasons = true;
      this.togglePanel();
    }
  }

  private showPropertyPanelForSpaceReasons(): void {
    this.propertyPanelHasNoSpace = false;
    this.propertyPanelHiddenForSpaceReasons = false;

    this.propertyPanelShouldOpen = true;
    this.togglePanel();
  }

  private resizeEventHandler = (event: MouseEvent): void => {
    this.hideOrShowPpForSpaceReasons();

    const mousePosition: number = event.clientX;

    this.setNewPropertyPanelWidthFromMousePosition(mousePosition);
  };

  private hideOrShowPpForSpaceReasons(): void {
    const minModelerWidthForPropertyPanel: number = this.minCanvasWidth + this.minPropertyPanelWidth;
    const modelerWidth: number = this.propertyPanel.parentElement.offsetWidth;

    if (modelerWidth === 0) {
      return;
    }

    this.propertyPanelHasNoSpace = modelerWidth < minModelerWidthForPropertyPanel;
    if (this.propertyPanelHasNoSpace) {
      this.hidePropertyPanelForSpaceReasons();
    } else if (this.propertyPanelHiddenForSpaceReasons) {
      this.showPropertyPanelForSpaceReasons();
    }
  }

  private setDjsPaletteLeftStyle(solutionExplorerIsActive: boolean): void {
    const bpmnIoPaletteContainer: HTMLElement = this.canvasModel.getElementsByClassName(
      'djs-palette',
    )[0] as HTMLElement;
    const djsPaletteLeft: number = solutionExplorerIsActive ? 250 : 0;

    bpmnIoPaletteContainer.style.left = `${djsPaletteLeft}px`;
  }

  /**
   * Handles an incoming printDiagram message.
   */
  private async printHandler(): Promise<void> {
    try {
      const svgToPrint: string = await this.getSVG();
      this.diagramPrintService.printDiagram(svgToPrint);
    } catch (error) {
      this.notificationService.showNotification(
        NotificationType.ERROR,
        'An error while trying to print the diagram occurred.',
      );
    }
  }

  /**
   * Handles a key down event and saves the diagram, if the user presses a CRTL + s key combination.
   *
   * If using macOS, this combination will be CMD + s.
   *
   * Saving is triggered by emitting @see environment.events.diagramDetail.saveDiagram
   *
   * @param event Passed key event.
   * @return void
   */
  private saveHotkeyEventHandler = (event: KeyboardEvent): void => {
    // On macOS the 'common control key' is the meta instead of the control key. So on a mac we need to find
    // out, if the meta key instead of the control key is pressed.
    const currentPlatformIsMac: boolean = this.checkIfCurrentPlatformIsMac();
    const metaKeyIsPressed: boolean = currentPlatformIsMac ? event.metaKey : event.ctrlKey;
    const shiftKeyIsPressed: boolean = event.shiftKey;

    /*
     * If both keys (meta and s) are pressed, save the diagram.
     * A diagram is saved, by throwing a saveDiagram event.
     *
     * @see environment.events.diagramDetail.saveDiagram
     */
    const sKeyIsPressed: boolean = event.key === 's';
    const userWantsToSave: boolean = metaKeyIsPressed && sKeyIsPressed && !shiftKeyIsPressed;
    const userWantsToSaveAs: boolean = metaKeyIsPressed && sKeyIsPressed && shiftKeyIsPressed;

    if (userWantsToSave) {
      event.preventDefault();

      this.eventAggregator.publish(environment.events.diagramDetail.saveDiagram);
      return;
    }

    if (userWantsToSaveAs) {
      event.preventDefault();
      this.eventAggregator.publish(environment.events.diagramDetail.saveDiagramAs);
    }
  };

  /**
   * On macOS it is typically to remove elements with the backspace instead
   * of the delete key. This Method binds the removal of a selected
   * element to the backspace key, if the current platform is macOS.
   */
  private addRemoveWithBackspaceKeyboardListener(): void {
    const currentPlatformIsNotMac: boolean = !this.checkIfCurrentPlatformIsMac();

    if (currentPlatformIsNotMac) {
      return;
    }

    const keyboard: IKeyboard = this.modeler.get('keyboard');
    const editorActions: IEditorActions = this.modeler.get('editorActions');
    const backSpaceKeyCode: number = 8;

    const removeSelectedElements = (key: IInternalEvent, modifiers: KeyboardEvent): boolean => {
      const backspaceWasPressed: boolean = key.keyEvent.keyCode === backSpaceKeyCode;

      if (backspaceWasPressed) {
        editorActions.trigger('removeSelection');

        return true;
      }

      return false;
    };

    keyboard.addListener(removeSelectedElements);
  }

  /**
   * Handles a key down event and prints the diagram, when the user presses CRTL + p.
   *
   * If using macOS, this combination will be CMD + p.
   *
   * Printing is triggered by emitting @see environment.events.diagramDetail.printDiagram
   *
   * @param event Passed key event.
   * @return void
   */
  private printHotkeyEventHandler = (event: KeyboardEvent): void => {
    // On macOS the 'common control key' is the meta instead of the control key. So on a mac we need to find
    // out, if the meta key instead of the control key is pressed.
    const currentPlatformIsMac: boolean = this.checkIfCurrentPlatformIsMac();
    const metaKeyIsPressed: boolean = currentPlatformIsMac ? event.metaKey : event.ctrlKey;

    /*
     * If both keys (meta and p) are pressed, print the diagram.
     * A diagram is printed, by throwing a printDiagram event.
     *
     * @see environment.events.diagramDetail.printDiagram
     */
    const pKeyIsPressed: boolean = event.key === 'p';
    const userWantsToPrint: boolean = metaKeyIsPressed && pKeyIsPressed;

    if (userWantsToPrint) {
      // Prevent the browser from handling the default action for CMD/CTRL + p.
      event.preventDefault();

      // TODO: Handle the promise properly
      this.getSVG().then((svg: string): void => {
        this.diagramPrintService.printDiagram(svg);
      });
    }
  };

  /**
   * Checks, if the current platform is a macOS.
   *
   * @returns true, if the current platform is macOS
   */
  private checkIfCurrentPlatformIsMac = (): boolean => {
    const macRegex: RegExp = /.*mac*./i;
    const currentPlatform: string = navigator.platform;
    const currentPlatformIsMac: boolean = macRegex.test(currentPlatform);

    return currentPlatformIsMac;
  };

  private async getSVG(): Promise<string> {
    const returnPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      if (this.solutionIsRemote) {
        this.viewer.saveSVG({}, (error: Error, result: string) => {
          if (error) {
            reject(error);
          }

          resolve(result);
        });
      } else {
        this.modeler.saveSVG({}, (error: Error, result: string) => {
          if (error) {
            reject(error);
          }

          resolve(result);
        });
      }
    });

    return returnPromise;
  }
}
