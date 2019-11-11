import download from 'downloadjs';
import {IDiagramExportRepositoryContracts} from '../../../../contracts/exportRepository';

export class DiagramExportRepository implements IDiagramExportRepositoryContracts {
  public exportDiagram(fileContent: string, outputName: string, mimeType: string): void {
    download(fileContent, outputName, mimeType);
  }
}
