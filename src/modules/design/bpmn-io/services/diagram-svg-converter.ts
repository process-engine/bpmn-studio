import {IExportService, ISvgConvertService} from '../../../../contracts/index';
import {ExportService} from './export.service';

export class DiagramSvgConverter implements ISvgConvertService {
  private enqueuedPromises: Array<Promise<string>> = [];
  private svgContent: string;

  constructor(svgContent: string) {
    this.svgContent = svgContent;
  }

  public asPNG(): IExportService {
    const pngExporterPromise: Promise<string> = this.pngExporter();
    const mimeType: string = 'image/png';

    this.enqueuedPromises.push(pngExporterPromise);

    return new ExportService(mimeType, this.enqueuedPromises);
  }

  public asJPEG(): IExportService {
    const jpegExporterPromise: Promise<string> = this.jpegExporter();
    const mimeType: string = 'image/jpeg';

    this.enqueuedPromises.push(jpegExporterPromise);

    return new ExportService(mimeType, this.enqueuedPromises);
  }

  public asSVG(): IExportService {
    const mimeType: string = 'image/svg+xml';
    const svgExporterPromise: Promise<string> = new Promise((resolve: Function): void => {
      resolve(this.svgContent);
    });

    this.enqueuedPromises.push(svgExporterPromise);

    return new ExportService(mimeType, this.enqueuedPromises);
  }

  /**
   * Exports the current diagram as a PNG image.
   */
  private pngExporter = async (): Promise<string> => {
    return this.generateImageFromSVG('png', this.svgContent);
  };

  /**
   * Exports the current diagram as a jpeg image.
   */
  private jpegExporter = async (): Promise<string> => {
    return this.generateImageFromSVG('jpeg', this.svgContent);
  };

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
   * the width and height of a canvas to match a rendered resolution
   * with the targeting DPI.
   *
   * @param svgWidth With of the diagrams canvas element.
   * @param svgHeight Height of the diagrams canvas element.
   * @param targetDPI DPI of the output.
   * @param diagonalSize Diagonal Size of the printed document.
   * @returns The needed pixel ratio for the current dimensions to achieve the
   * desired DPI.
   */
  private calculatePixelRatioForDPI(
    svgWidth: number,
    svgHeight: number,
    targetDPI: number,
    diagonalSize: number,
  ): number {
    const square: Function = (num: number): number => num * num;

    const svgWidthSquared: number = square(svgWidth);
    const svgHeightSquared: number = square(svgHeight);

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
