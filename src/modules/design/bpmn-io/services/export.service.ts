import {IExportService} from '../../../../contracts/index';
import {DiagramExportRepository} from '../repositories/diagram-export.repository';

export class ExportService implements IExportService {
  private enqueuedPromises: Array<Promise<string>>;
  private exportDiagramRepository: DiagramExportRepository;
  private currentMimeType: string;

  constructor(currentMimeType: string, enqueuedPromises: Array<Promise<string>>) {
    this.currentMimeType = currentMimeType;
    this.enqueuedPromises = enqueuedPromises;
    this.exportDiagramRepository = new DiagramExportRepository();
  }

  public async export(filename: string): Promise<void> {
    /*
     * Wait, until all queued functions are executed
     */
    const contentToExport: string = await this.enqueuedPromises.reduce(
      (lastPromise: Promise<string>, currentPromise: Promise<string>): Promise<string> => {
        return lastPromise.then((result: string) => {
          return currentPromise;
        });
      },
    );

    /*
     * If all exporters are finished, save the diagram to disk using the
     * defined export repository.
     */
    this.exportDiagramRepository.exportDiagram(contentToExport, filename, this.currentMimeType);

    /*
     * After exporting, we can reset the queued promises.
     */
    this.enqueuedPromises = [];
  }
}
