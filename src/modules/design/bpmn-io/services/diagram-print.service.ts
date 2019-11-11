import * as print from 'print-js';
import {IDiagramPrintService} from '../../../../contracts';

export class DiagramPrintService implements IDiagramPrintService {
  private svg: string;

  constructor(svg?: string) {
    this.svg = svg;
  }

  /**
   * Prepares the current diagram for printing and opens the system's print
   * dialogue.
   *
   * @param [svg] SVG content that should be printed
   * @throws Error if no source SVG was defined.
   */
  public async printDiagram(svg?: string): Promise<void> {
    let svgToPrint: string;

    if (svg !== undefined) {
      svgToPrint = svg;
    } else if (this.svg !== undefined && this.svg !== null) {
      svgToPrint = this.svg;
    } else {
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject('No SVG for printing defined');
    }

    const png: string = await this.generateImageFromSVG('png', svgToPrint);

    const printOptions: {printable: string; type?: string} = {
      printable: png,
      type: 'image',
    };

    print.default(printOptions);
    return Promise.resolve();
  }

  public updateSVG(newSVG: string): void {
    this.svg = newSVG;
  }

  /**
   * Converts the given xml into an image. The returning value is a DataURL that
   * points to the created image.
   *
   * @param desiredImageType Output type of the image.
   * @param svg SVG that should be converted into an image with the desired format.
   * @returns A DataURL that points to the created image.
   */
  private async generateImageFromSVG(desiredImageType: string, svg: string): Promise<string> {
    const encoding: string = `image/${desiredImageType}`;
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    const context: CanvasRenderingContext2D = canvas.getContext('2d');

    // eslint-disable-next-line no-useless-escape
    const svgWidth: number = parseInt(svg.match(/<svg[^>]*width\s*=\s*\"?(\d+)\"?[^>]*>/)[1]);
    // eslint-disable-next-line no-useless-escape
    const svgHeight: number = parseInt(svg.match(/<svg[^>]*height\s*=\s*\"?(\d+)\"?[^>]*>/)[1]);

    // For a print, we use 300 dpi
    const targetDPI: number = 300;

    /*
     * TODO: Figure out, how to obtain the desired format of the print before
     * printing. In the current implementation, I assume that we print to a
     * DIN A4 Paper, which has a diagonal size of 14.17 inches.
     */
    const dinA4DiagonalSizeInch: number = 14.17;
    const pixelRatio: number = this.calculatePixelRatioForDPI(svgWidth, svgHeight, targetDPI, dinA4DiagonalSizeInch);

    canvas.width = svgWidth * pixelRatio;
    canvas.height = svgHeight * pixelRatio;

    // Make the background white for every format
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image to the canvas
    const imageDataURL: string = await this.drawSVGToCanvas(svg, canvas, context, encoding);

    return imageDataURL;
  }

  /**
   * Calculate the pixel ratio for the given DPI.
   * The Pixel Ratio is the factor which is needed, to extend the
   * width and height of a canvas to match a rendered resolution
   * with the targeting DPI.
   *
   * @param svgWidth With of the diagrams canvas element.
   * @param svgHeight Height of the diagrams canvas element.
   * @param targetDPI DPI of the output.
   * @param diagonalSize Diagonal Size of the printed document.
   */
  private calculatePixelRatioForDPI(
    svgWidth: number,
    svgHeight: number,
    targetDPI: number,
    diagonalSize: number,
  ): number {
    const svgWidthSquared: number = svgWidth ** 2;
    const svgHeightSquared: number = svgHeight ** 2;

    const diagonalResolution: number = Math.sqrt(svgWidthSquared + svgHeightSquared);

    const originalDPI: number = diagonalResolution / diagonalSize;
    const pixelRatio: number = targetDPI / originalDPI;

    return pixelRatio;
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
  private async drawSVGToCanvas(
    svgContent: string,
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    encoding: string,
  ): Promise<string> {
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

    const loadImagePromise: Promise<string> = new Promise((resolve: Function, reject: Function): void => {
      imageElement.onload = (): void => {
        context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        const encodedImageURL: string = canvas.toDataURL(encoding);
        resolve(encodedImageURL);
      };

      imageElement.onerror = (errorEvent: ErrorEvent): void => {
        reject(errorEvent);
      };
    });

    return loadImagePromise;
  }
}
