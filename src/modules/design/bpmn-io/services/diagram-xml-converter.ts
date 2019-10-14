import {IExportService, IXmlConvertService} from '../../../../contracts/index';

import {ExportService} from './export.service';

export class DiagramXmlConverter implements IXmlConvertService {
  private xmlContent: string;
  private enqueuedPromises: Array<Promise<string>> = [];

  constructor(xmlContent: string) {
    this.xmlContent = xmlContent;
  }

  public asBpmn(): IExportService {
    const formatterPromise: Promise<string> = this.bpmnExporter();
    const mimeType: string = 'application/bpmn20-xml';

    this.enqueuedPromises.push(formatterPromise);

    return new ExportService(mimeType, this.enqueuedPromises);
  }

  /**
   * Formats the current loaded xml.
   */
  private bpmnExporter = async (): Promise<string> => {
    return Promise.resolve(this.xmlContent);
  };
}
