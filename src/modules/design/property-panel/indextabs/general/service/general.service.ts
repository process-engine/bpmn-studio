import {inject} from 'aurelia-framework';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import {GeneralRepository} from '../repository/general.repository';

@inject(GeneralRepository)
export class GeneralService {
  private generalRepository: GeneralRepository;

  constructor(generalRepository: GeneralRepository) {
    this.generalRepository = generalRepository;
  }

  public generateRandomId(): string {
    let randomId: string = '';
    const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    const randomIdLength: number = 8;
    for (let i: number = 0; i < randomIdLength; i++) {
      randomId += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return randomId;
  }

  public getAllDiagrams(): Promise<Array<IDiagram>> {
    return this.generalRepository.getAllDiagrams();
  }

  public async getAllStartEventsForDiagram(diagramName: string): Promise<Array<IShape>> {
    const allDiagrams: Array<IDiagram> = await this.getAllDiagrams();

    const diagramForStartEvents = allDiagrams.find((diagram: IDiagram) => diagram.name === diagramName);

    if (!diagramForStartEvents) {
      throw new Error(`Diagram with name '${diagramName}' not found.`);
    }

    return this.generalRepository.getAllStartEventsForDiagram(diagramForStartEvents);
  }
}
