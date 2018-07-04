import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Redirect, Router} from 'aurelia-router';
import {ValidateEvent, ValidationController} from 'aurelia-validation';

import {IProcessDefEntity} from '@process-engine/process_engine_contracts';
import * as download from 'downloadjs';
import * as print from 'print-js';
import * as beautify from 'xml-beautifier';

import {
  AuthenticationStateEvent,
  IExtensionElement,
  IFormElement,
  IModdleElement,
  IProcessEngineService,
  IShape,
  NotificationType,
} from '../../contracts/index';

import environment from '../../environment';
import {BpmnIo} from '../bpmn-io/bpmn-io';
import {NotificationService} from './../notification/notification.service';

interface RouteParameters {
  processDefId: string;
}

@inject('ProcessEngineService', EventAggregator, Router, ValidationController, 'NotificationService')
export class ProcessDefDetail {

  public bpmnio: BpmnIo;
  public process: IProcessDefEntity;

  private _processEngineService: IProcessEngineService;
  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _processId: string;
  private _router: Router;
  private _diagramHasChanged: boolean = false;
  private _validationController: ValidationController;
  // TODO: Explain when this is set and by whom.
  private _diagramIsInvalid: boolean = false;
  // Used to control the modal view; shows the modal view for pressing the play button.
  private _startButtonPressed: boolean = false;

  constructor(processEngineService: IProcessEngineService,
              eventAggregator: EventAggregator,
              router: Router,
              validationController: ValidationController,
              notificationService: NotificationService) {

    this._processEngineService = processEngineService;
    this._eventAggregator = eventAggregator;
    this._router = router;
    this._validationController = validationController;
    this._notificationService = notificationService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    this._processId = routeParameters.processDefId;
    this._diagramHasChanged = false;
    await this._refreshProcess();
  }

  public attached(): void {
    this._subscriptions = [
      //  Aurelia Event Subscriptions {{{ //
      // Aurelia will expose the ValidateEvent, we use this to check the BPMN in the modeler.
      this._validationController.subscribe((event: ValidateEvent) => {
        this._handleFormValidateEvents(event);
      }),
      //  }}} Aurelia Event Subscriptions //

      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this._refreshProcess();
      }),
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this._refreshProcess();
      }),

      //  Button Subscriptions {{{ //
      this._eventAggregator.subscribe(environment.events.processDefDetail.saveDiagram, () => {
        this._saveDiagram()
          .catch((error: Error) => {
            this
              ._notificationService
              .showNotification(
                NotificationType.ERROR,
                `Error while saving the diagram: ${error.message}`,
              );
          });
      }),
      //  Export Subscriptions {{{ //
      this._eventAggregator.subscribe(`${environment.events.processDefDetail.exportDiagramAs}:BPMN`, () => {
        this._exportBPMN();
      }),
      this._eventAggregator.subscribe(`${environment.events.processDefDetail.exportDiagramAs}:SVG`, () => {
        this._exportSVG();
      }),
      this._eventAggregator.subscribe(`${environment.events.processDefDetail.exportDiagramAs}:PNG`, () => {
        this._exportPNG();
      }),
      this._eventAggregator.subscribe(`${environment.events.processDefDetail.exportDiagramAs}:JPEG`, () => {
        this._exportJPEG();
      }),
      //  }}} Export Subscriptions //

      //  Start Button Subscription {{{ //
      this._eventAggregator.subscribe(environment.events.processDefDetail.startProcess, () => {
        this._startProcess();
      }),
      //  }}} Start Button Subscription //
      //  }}} Button Subscriptions //

      //  General Event Subscritions {{{ //
      this._eventAggregator.subscribe(environment.events.diagramChange, () => {
        this._diagramHasChanged = true;
      }),
      this._eventAggregator.subscribe(environment.events.processDefDetail.printDiagram, () => {
        this._printDiagram();
      }),
      //  }}} General Event Subscritions //
    ];

    this._eventAggregator.publish(environment.events.navBar.showTools, this.process);
    this._eventAggregator.publish(environment.events.statusBar.showXMLButton);
  }

  /**
   * We implement canDeactivate() for the Aurelia Router, because we want to
   * prevent the user from leaving the editor, if there are changes, that need
   * to be saved.
   *
   * Basically, the Router will look for an implementation and execute this
   * method. The Aurelia Router is not working properly at this moment, so we use a workaround to achieve this:
   *
   * We return a Promise with a redirection to the previous view!
   * This will preserve the state and works as expected.
   *
   */
  public async canDeactivate(): Promise<Redirect> {

    const _modal: Promise<boolean> = new Promise((resolve: Function, reject: Function): any => {

      if (!this._diagramHasChanged) {
        resolve(true);

      } else {

        const modal: HTMLElement = this._startButtonPressed
          ? document.getElementById('saveModalProcessStart')
          : document.getElementById('saveModalLeaveView');

        modal.classList.add('show-modal');

        //  register onClick handler {{{ //
        /* Do not save and leave */
        const dontSaveButtonId: string = 'dontSaveButtonLeaveView';
        document
          .getElementById(dontSaveButtonId)
          .addEventListener('click', () => {

            modal.classList.remove('show-modal');

            this._diagramHasChanged = false;

            resolve(true);
          });

        /* Save and leave */
        const saveButtonId: string = this._startButtonPressed
          ? 'saveButtonProcessStart'
          : 'saveButtonLeaveView';

        document
          .getElementById(saveButtonId)
          .addEventListener('click', () => {

            this
              ._saveDiagram()
              .catch((error: Error) => {
                this._notificationService.showNotification(NotificationType.ERROR, `Unable to save the diagram: ${error.message}`);
              });

            modal.classList.remove('show-modal');

            this._diagramHasChanged = false;
            this._startButtonPressed = false;

            resolve(true);
          });

        /* Stay, do not save */
        const cancelButtonId: string = this._startButtonPressed
          ? 'cancelButtonProcessStart'
          : 'cancelButtonLeaveView';

        document
          .getElementById(cancelButtonId)
          .addEventListener('click', () => {
            modal.classList.remove('show-modal');

            this._startButtonPressed = false;

            resolve(false);
          });
        }
        //  }}} register onClick handler //
    });

    const result: boolean = await _modal;

    // TODO: Extract Business Rule
    if (result === false) {
      /*
       * As suggested in https://github.com/aurelia/router/issues/302, we use
       * the router directly to navigate back, which results in staying on this
       * component-- and this is the desired behaviour.
       */
      return new Redirect(this._router.currentInstruction.fragment, {trigger: false, replace: false});
    }
  }

  public detached(): void {
    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }

    this._eventAggregator.publish(environment.events.navBar.hideTools);
    this._eventAggregator.publish(environment.events.statusBar.hideXMLButton);
  }

  private _refreshProcess(): Promise<IProcessDefEntity> {
    return this
      ._processEngineService
      .getProcessDefById(this._processId)
      .then((result: any) => {
        // TODO: Extract Business Rule
        if (result && !result.error) {
          this.process = result;

          this
            ._eventAggregator
            .publish(environment.events.navBar.updateProcess, this.process);

          return this.process;

        } else {
          this.process = null;
          return result.error;
        }
    });
  }

  /**
   * This sets the _startButtonPressed flag to control the modal view of the save dialog.
   *
   * If the process is not valid, it will not start it.
   */
  private _startProcess(): void {
    this._dropInvalidFormData();

    if (this._diagramIsInvalid) {
      this
        ._notificationService
        .showNotification(
          NotificationType.WARNING,
          'Unable to start the process, because it is not valid. This could have something to do with your latest changes. Try to undo them.',
        );
      return;
    }

    this._startButtonPressed = true;

    this._router.navigate(`processdef/${this.process.id}/start`);
  }

  /**
   * Currently unused Method.
   *
   * TODO: Look deeper into this if we need this method anymore and/or in this
   * particular way.
   *
   * TODO: Use this again.
   */
  private _deleteProcess(): void {
    const userIsSureOfDeletion: boolean = confirm('Are you sure you want to delete the process definition?');

    if (userIsSureOfDeletion) {
      this
        ._processEngineService
        .deleteProcessDef(this.process.id)
        .then(() => {
          this.process = null;
          this._router.navigate('');
        })
        .catch((error: Error) => {
          this._notificationService.showNotification(NotificationType.ERROR, error.message);
        });
    }
  }

  /**
   * This method will save the diagram by using the ProcessEngineService.
   *
   * The user will be notified, about the outcome of the operation. Errors will be
   * reported reasonably and a success message will be emitted.
   *
   * Saving is not possible, if _diagramIsInvalid has been set to true.
   *
   * The source of the XML is the bmpn.io-modeler. It is used to extract the BPMN
   * while saving; a validation is not executed here.
   */
  private async _saveDiagram(): Promise<void> {

    this._dropInvalidFormData();

    if (this._diagramIsInvalid) {
      this
        ._notificationService
        .showNotification(
          NotificationType.WARNING,
          'Unable to save the diagram, because it is not valid. This could have something to do with your latest changes. Try to undo them.',
        );
      return;
    }

    //  Save the diagram to the ProcessEngine {{{ //
    // TODO: Explain what this is doing -> Refactor.
    let response: any;

    try {
      const xml: string = await this.bpmnio.getXML();
      response = await this._processEngineService.updateProcessDef(this.process, xml);
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR, `Somethig happend: ${error.message}`);
    }
    //  }}} Save the diagram to the ProcessEngine //

    // Treat possible errors {{{ //
    if (response.error) {
      this
        ._notificationService
        .showNotification(NotificationType.ERROR, `Unable to save the file: ${response.error}`);

    } else if (response.result) {
      this
        ._notificationService
        .showNotification(NotificationType.SUCCESS, 'File saved.');

    } else {
      // TODO: Not gonna buy this. Is this needed at all?
      this
        ._notificationService
        .showNotification(
          NotificationType.WARNING,
          `Something is very wrong: ${JSON.stringify(response)}. Please contact the BPMN-Studio team, they can help.`,
        );
    }
    //  }}}  Treat possible errors //

    this._diagramHasChanged = false;
  }

  /**
   * In the current implementation this method only checks for UserTasks that have
   * empty or otherwise not allowed FormData in them.
   *
   * If that is the case the method will continue by deleting unused/not allowed
   * FormData to make sure the diagrams XML is further supported by Camunda.
   *
   * TODO: Look further into this if this method is not better placed at the FormsSection
   * in the Property Panel, also split this into two methods and name them right.
   */
  private _dropInvalidFormData(): void {
    const registry: Array<IShape> = this.bpmnio.modeler.get('elementRegistry');

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

  //  Exporting Functions - Probably an ExportService is a better idea {{{ //

  /**
   * Exports the current diagramm as a *.bpmn xml file.
   */
  private async _exportBPMN(): Promise<void> {
    const xml: string = await this.bpmnio.getXML();
    const formattedXml: string = beautify(xml);

    download(formattedXml, `${this.process.name}.bpmn`, 'application/bpmn20-xml');
  }

  /**
   * Exports the current Diagram as a SVG file and prompts the user to save
   * the exported file.
   */
  private async _exportSVG(): Promise<void> {
    const svg: string = await this.bpmnio.getSVG();

    download(svg, `${this.process.name}.svg`, 'image/svg+xml');
  }

  /**
   * Exports the current Diagram as a PNG file and prompts the user to save
   * the exported file.
   */
  private async _exportPNG(): Promise<void> {
    const svg: string = await this.bpmnio.getSVG();

    try {
      const imageURL: string = await this._generateImageFromSVG('png', svg);
      download(imageURL, `${this.process.name}.png`, 'image/png');
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR,
        `An error occurred while processing the image for exporting.`);
    }
  }

  /**
   * Exports the current Diagram as a JPEG file and prompts the user to save
   * the exported file.
   */
  private async _exportJPEG(): Promise<void> {
    const svg: string = await this.bpmnio.getSVG();

    try {
      const imageURL: string = await this._generateImageFromSVG('jpeg', svg);
      download(imageURL, `${this.process.name}.jpeg`, 'image/jpeg');
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR,
        `An error occurred while processing the image for exporting.`);
    }
  }

  /**
   * This heavily relies on the resolution of the screen.
   *
   * The result should be a pretty diagram for a printer;
   * the generated image will be obtain from the BPMN.io canvas,
   * that is dependent on the screen size.
   */
  public async _printDiagram(): Promise<void> {
    const svg: string = await this.bpmnio.getSVG();

    try {
      const png: string = await this._generateImageFromSVG('png', svg);
      print.default({printable: png, type: 'image'});
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR,
        `An error occurred while processing the image for printing.`);
    }
  }

  private async _generateImageFromSVG(desiredImageType: string, svg: string): Promise<string> {
    const encoding: string = `image/${desiredImageType}`;
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    const context: CanvasRenderingContext2D = canvas.getContext('2d');

    const svgWidth: number = parseInt(svg.match(/<svg[^>]*width\s*=\s*\"?(\d+)\"?[^>]*>/)[1]);
    const svgHeight: number = parseInt(svg.match(/<svg[^>]*height\s*=\s*\"?(\d+)\"?[^>]*>/)[1]);

    // For a print, we use 300 dpi
    const targetDPI: number = 300;

    /*
     * TODO: Figure out, how to obtain the desired format of the print before
     * printing. In the current implementation, I assume that we print to a
     * DIN A4 Paper, which has a diagonal size of 14.17 inches.
    */
    const dinA4DiagonalSizeInch: number = 14.17;
    const pixelRatio: number = this._calculatePixelRatioForDPI(svgWidth, svgHeight, targetDPI, dinA4DiagonalSizeInch);

    canvas.width = svgWidth * pixelRatio;
    canvas.height = svgHeight * pixelRatio;

    // Make the background white for every format
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image to the canvas
    const imageDataURL: string = await this._drawSVGToCanvas(svg, canvas, context, encoding);

    return imageDataURL;
  }

/**
 * Draws a given SVG image to a Canvas and converts it to an image.
 *
 * @param svgContent SVG Content that should be drawn to the image.
 * @param canvas Canvas, in which the SVG image should be drawn.
 * @param context Context of the Canvas.
 * @param encoding Encoding of the output image.
 * @returns The URL which points to the rendered image.
 */
  private async _drawSVGToCanvas(
    svgContent: string,
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    encoding: string): Promise<string> {

    const imageElement: HTMLImageElement = document.createElement('img');

    /*
     * This makes sure, that the base64 encoded SVG does not contain any
     * escaped html characters (such as &lt; instead of <).
     *
     * TODO: The unescape Method is marked as deprecated.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/unescape
     *
     * The problem is, that the replacement method decodeURI does not work in this case
     * (it behaves kinda different in some situations).
     * Event the MDN use the unescape method to solve this kind of problem:
     * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/btoa#Unicode_strings
     *
     * There is an npm packet that implements the original unescape function.
     * Maybe we can use this to make sure that this won't cause any
     * problems in the future.
     */
    const encodedSVG: string = btoa(unescape(encodeURIComponent(svgContent)));
    imageElement.setAttribute('src', `data:image/svg+xml;base64, ${encodedSVG}`);

    const returnPromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      imageElement.onload = (): void => {
        context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        const encodedImageURL: string = canvas.toDataURL(encoding);
        resolve(encodedImageURL);
      };

      imageElement.onerror = (errorEvent: ErrorEvent): void => {
        /*
         * TODO: Find out if we can reject the promise with a more specify
         * error here.
         */
        reject(errorEvent);
      };
    });

    return returnPromise;
  }

  /**
   * Calculate the pixel ratio for the given DPI.
   * The Pixel Ratio is the factor which is needed, to extend the
   * the width and height of a canvas to match a rendered resolution
   * with the targeting DPI.
   *
   * @param svgWidth With of the diagrams canvas element.
   * @param svgHeight Height of the diagrams canvas element.
   * @param targetDPI DPI of the output.
   * @param diagonalSize Diagonal Size of the printed document.
   */
  private _calculatePixelRatioForDPI(svgWidth: number, svgHeight: number, targetDPI: number, diagonalSize: number): number {

    // tslint:disable:no-magic-numbers
    const svgWidthSquared: number = Math.pow(svgWidth, 2);
    const svgHeightSquared: number = Math.pow(svgHeight, 2);

    const diagonalResolution: number = Math.sqrt(svgWidthSquared + svgHeightSquared);

    const originalDPI: number = diagonalResolution / diagonalSize;
    const pixelRatio: number = targetDPI / originalDPI;

    return pixelRatio;
  }
  //  }}} Exporting Functions - Probably an ExportService is a better idea //

  /**
   * This handler will set the diagram state to invalid, if the ValidateEvent arrives.
   * Currently only form fields in the Property Panel are validated. This will cause
   * the following behaviour:
   *
   * The user inserts an invalid string (e.g. he uses a already used Id for an element);
   * The Aurelia validators will trigger; the validation event will arrive here;
   * if there are errors present, we will disable the save button and the save functionality
   * by setting the _diagramIsInvalid flag to true.
   *
   * Events fired here:
   *
   * 1. disableSaveButton
   * 2. enableSaveButton
   */
  private _handleFormValidateEvents(event: ValidateEvent): void {
    const eventIsValidateEvent: boolean = event.type !== 'validate';

    if (eventIsValidateEvent) {
      return;
    }

    for (const result of event.results) {
      const resultIsNotValid: boolean = result.valid === false;

      if (resultIsNotValid) {
        this._diagramIsInvalid = true;
        this._eventAggregator
          .publish(environment.events.navBar.disableSaveButton);

        return;
      }
    }

    this._eventAggregator
      .publish(environment.events.navBar.enableSaveButton);

    this._diagramIsInvalid = false;
  }
}
