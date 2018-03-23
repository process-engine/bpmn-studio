import {BpmnStudioClient} from '@process-engine/bpmn-studio_client';
import {ICoreAPIService} from '@process-engine/bpmn-studio_core_contracts';
import {IProcessDefEntity} from '@process-engine/process_engine_contracts';
import {bindingMode} from 'aurelia-binding';
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {ValidateEvent, ValidationController} from 'aurelia-validation';
import * as canvg from 'canvg-browser';
import * as download from 'downloadjs';
import * as $ from 'jquery';
import * as spectrum from 'spectrum-colorpicker';
import 'spectrum-colorpicker/spectrum';
import * as toastr from 'toastr';
import {AuthenticationStateEvent,
        ElementDistributeOptions,
        IExtensionElement,
        IFormElement,
        IModdleElement,
        IProcessEngineService,
        IShape} from '../../contracts/index';
import environment from '../../environment';

interface RouteParameters {
  processDefId: string;
}

interface BpmnStudioColorPickerSettings {
  clickoutFiresChange: boolean;
  showPalette: boolean;
  palette: Array<Array<string>>;
  localStorageKey: string;
  showInitial: boolean;
  showInput: boolean;
  allowEmpty: boolean;
  showButtons: boolean;
  showPaletteOnly: boolean;
  togglePaletteOnly: boolean;

  move?(color: spectrum.tinycolorInstance): void;
}

@inject('ProcessEngineService', EventAggregator, 'BpmnStudioClient', Router, ValidationController, 'CoreAPIService')
export class ProcessDefDetail {

  private processEngineService: IProcessEngineService;
  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;
  private processId: string;
  private _process: IProcessDefEntity;
  private exportButton: HTMLButtonElement;
  private exportDropdown: HTMLButtonElement;
  private exportSpinner: HTMLElement;
  private startButtonDropdown: HTMLDivElement;
  private startButton: HTMLElement;
  private bpmnStudioClient: BpmnStudioClient;
  private router: Router;
  private fillColor: string;
  private borderColor: string;
  private showXMLView: boolean = false;

  private coreAPIService: ICoreAPIService;

  public colorPickerBorder: HTMLInputElement;
  public colorPickerFill: HTMLInputElement;
  public colorPickerLoaded: boolean = false;

  public validationController: ValidationController;
  public validationError: boolean;

  @bindable() public uri: string;
  @bindable() public name: string;
  @bindable() public startedProcessId: string;
  @bindable({ defaultBindingMode: bindingMode.oneWay }) public initialLoadingFinished: boolean = false;

  constructor(processEngineService: IProcessEngineService,
              eventAggregator: EventAggregator,
              bpmnStudioClient: BpmnStudioClient,
              router: Router,
              validationController: ValidationController,
              coreAPIService: ICoreAPIService) {
    this.processEngineService = processEngineService;
    this.eventAggregator = eventAggregator;
    this.bpmnStudioClient = bpmnStudioClient;
    this.router = router;
    this.validationController = validationController;
    this.coreAPIService = coreAPIService;
  }

  public activate(routeParameters: RouteParameters): void {
    this.processId = routeParameters.processDefId;
    this.refreshProcess();
  }

  public attached(): void {
    this.validationController.subscribe((event: ValidateEvent) => {
      this.validateForm(event);
    });

    this.subscriptions = [
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this.refreshProcess();
      }),
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this.refreshProcess();
      }),
    ];

    // setTimeout() gives us the callback queue, that causes
    // the initLoadingFinished boolean to become true as late as possible
    // so as soon as the view-model is fully attached
    // the bpmn-xml-view module gets attached and calls
    // the highlight method
    setTimeout(() => {
      this.initialLoadingFinished = true;
    }, 0);
  }

  private _activateColorPicker(): void {
    const borderMoveSetting: spectrum.Options = {
      move: (borderColor: spectrum.tinycolorInstance): void => {
        this.updateBorderColor(borderColor);
      },
    };

    const colorPickerBorderSettings: BpmnStudioColorPickerSettings = Object.assign({}, environment.colorPickerSettings, borderMoveSetting);
    $(this.colorPickerBorder).spectrum(colorPickerBorderSettings);

    const fillMoveSetting: spectrum.Options = {
      move: (fillColor: spectrum.tinycolorInstance): void => {
        this.updateFillColor(fillColor);
      },
    };

    const colorPickerFillSettings: BpmnStudioColorPickerSettings = Object.assign({}, environment.colorPickerSettings, fillMoveSetting);
    $(this.colorPickerFill).spectrum(colorPickerFillSettings);

    this.colorPickerLoaded = true;
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    $(this.colorPickerBorder).spectrum('destroy');
    $(this.colorPickerFill).spectrum('destroy');
  }

  public async toggleXMLView(): Promise<void> {
    if (!this.showXMLView) {
      this.process.xml = await this.bpmn.getXML();
      this.showXMLView = true;
    } else {
      this.showXMLView = false;
    }
  }

  private refreshProcess(): void {
    this.processEngineService.getProcessDefById(this.processId)
      .then((result: any) => {
        if (result && !result.error) {
          this._process = result;
          this.coreAPIService.setXML(this._process.xml);
        } else {
          this._process = null;
        }
    });
  }

  public startProcess(): void {
    this.router.navigate(`processdef/${this.process.id}/start`);
  }

  public closeProcessStartDropdown(): void {
    this.startButton.removeAttribute('disabled');
  }

  public deleteProcess(): void {
    const deleteForReal: boolean = confirm('Are you sure you want to delete the process definition?');
    if (!deleteForReal) {
      return;
    }
    this.processEngineService.deleteProcessDef(this.process.id)
      .then(() => {
        this._process = null;
        this.router.navigate('');
      })
      .catch((error: Error) => {
        toastr.error(error.message);
      });
  }

  @computedFrom('_process')
  public get process(): IProcessDefEntity {
    return this._process;
  }

  public onModdlelImported(moddle: any, xml: string): void {
    this.bpmn.xml = xml;
  }

  public async saveDiagram(): Promise<void> {

    this.validateXML();

    try {
      const xml: string = await this.bpmn.getXML();
      const response: any = await this.processEngineService.updateProcessDef(this.process, xml);

      if (response.error) {
        toastr.error(`Error while saving file: ${response.error}`);
      } else if (response.result) {
        toastr.success('File saved.');
      } else {
        toastr.warning(`Unknown error: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      toastr.error(`Error: ${error.message}`);
    }
  }

  private validateXML(): void {
    const registry: Array<IShape> = this.bpmn.modeler.get('elementRegistry');

    registry.forEach((element: IShape) => {
      if (element.type === 'bpmn:UserTask') {
        const businessObj: IModdleElement = element.businessObject;

        if (businessObj.extensionElements) {
          const extensions: IExtensionElement = businessObj.extensionElements;

          extensions.values = extensions.values.filter((value: IFormElement) => {
            const keepThisValue: boolean = value.$type !== 'camunda:FormData' || value.fields.length > 0;
            return keepThisValue;
          });

          if (extensions.values.length === 0) {
            delete businessObj.extensionElements;
          }
        }
      }
    });
  }

  public async exportBPMN(): Promise<void> {
    this.disableAndHideControlsForImageExport();

    const xml: string = await this.bpmn.getXML();
    download(xml, `${this.process.name}.bpmn`, 'application/bpmn20-xml');

    this.enableAndShowControlsForImageExport();
  }

  public async exportSVG(): Promise<void> {
    this.disableAndHideControlsForImageExport();

    const svg: string = await this.bpmn.getSVG();
    download(svg, `${this.process.name}.svg`, 'image/svg+xml');

    this.enableAndShowControlsForImageExport();
  }

  public async exportPNG(): Promise<void> {
    this.disableAndHideControlsForImageExport();

    const svg: string = await this.bpmn.getSVG();
    download(this.generateImageFromSVG('png', svg), `${this.process.name}.png`, 'image/png');

    this.enableAndShowControlsForImageExport();
  }

  public async exportJPEG(): Promise<void> {
    this.disableAndHideControlsForImageExport();

    const svg: string = await this.bpmn.getSVG();
    download(this.generateImageFromSVG('jpeg', svg), `${this.process.name}.jpeg`, 'image/jpeg');

    this.enableAndShowControlsForImageExport();
  }

  public generateImageFromSVG(desiredImageType: string, svg: any): string {
    const encoding: string = `image/${desiredImageType}`;
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    const context: CanvasRenderingContext2D = canvas.getContext('2d');

    canvg(canvas, svg);
    // make the background white for every format
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const image: string = canvas.toDataURL(encoding); // returns a base64 datastring
    return image;
  }

  public goBack(): void {
    this.router.navigateBack();
  }

  private disableAndHideControlsForImageExport(): void {
    this.exportButton.setAttribute('disabled', '');
    this.exportDropdown.setAttribute('disabled', '');
    this.exportSpinner.classList.remove('hidden');
  }

  private enableAndShowControlsForImageExport(): void {
    this.exportButton.removeAttribute('disabled');
    this.exportDropdown.removeAttribute('disabled');
    this.exportSpinner.classList.add('hidden');
  }

  public distributeElementsHorizontal(): void {
    this.bpmn.distributeElements(ElementDistributeOptions.HORIZONTAL);
  }

  public distributeElementsVertical(): void {
    this.bpmn.distributeElements(ElementDistributeOptions.VERTICAL);
  }

  public setColorRed(): void {
    this.bpmn.setColor('#FFCDD2', '#E53935');
  }

  public setColorBlue(): void {
    this.bpmn.setColor('#BBDEFB', '#1E88E5');
  }

  public setColorOrange(): void {
    this.bpmn.setColor('#FFE0B2', '#FB8C00');
  }

  public setColorGreen(): void {
    this.bpmn.setColor('#C8E6C9', '#43A047');
  }

  public setColorPurple(): void {
    this.bpmn.setColor('#E1BEE7', '#8E24AA');
  }

  public removeColor(): void {
    this.bpmn.setColor(null, null);
  }

  public setColorPicked(): void {
    this.bpmn.setColor(this.fillColor, this.borderColor);
  }

  private updateFillColor(fillColor: any): void {
    if (fillColor) {
      this.fillColor = fillColor.toHexString();
    } else {
      this.fillColor = null;
    }

    this.setColorPicked();
  }

  private updateBorderColor(borderColor: any): void {
    if (borderColor) {
      this.borderColor = borderColor.toHexString();
    } else {
      this.borderColor = null;
    }

    this.setColorPicked();
  }

  public updateCustomColors(): void {
    if (!this.colorPickerLoaded) {
      this._activateColorPicker();
    }

    [this.fillColor, this.borderColor] = this.bpmn.getColors();

    $(this.colorPickerFill).spectrum('set', this.fillColor);
    $(this.colorPickerBorder).spectrum('set', this.borderColor);
  }

  private validateForm(event: ValidateEvent): void {
    if (event.type !== 'validate') {
      return;
    }

    this.validationError = false;

    for (const result of event.results) {
      if (result.valid === false) {
        this.validationError = true;
        return;
      }
    }
  }

}
