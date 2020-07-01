/* eslint-disable 6river/new-cap */
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import * as bundle from '@process-engine/bpmn-js-custom-bundle';

import {IShape} from '@process-engine/bpmn-elements_contracts';
import {IBpmnModeler, IElementRegistry, ISolutionEntry, ISolutionService} from '../../../../../../contracts';

@inject('SolutionService', Router)
export class GeneralRepository {
  private solutionService: ISolutionService;
  private router: Router;

  constructor(solutionService: ISolutionService, router: Router) {
    this.solutionService = solutionService;
    this.router = router;
  }

  public async getAllDiagrams(): Promise<Array<IDiagram>> {
    const currentSolutionUri: string = this.router.currentInstruction.queryParams.solutionUri;

    const solutionEntry: ISolutionEntry = await this.solutionService.getSolutionEntryForUri(currentSolutionUri);
    const solution: ISolution = await solutionEntry.service.loadSolution();

    const allDiagramsInSolution: Array<IDiagram> = solution.diagrams;

    return allDiagramsInSolution;
  }

  public async getAllStartEventsForDiagram(diagram: IDiagram): Promise<Array<IShape>> {
    const modeler: IBpmnModeler = new bundle.modeler({
      moddleExtensions: {
        camunda: bundle.camundaModdleDescriptor,
      },
    });

    await this.importXmlIntoModeler(modeler, diagram.xml);

    const elementRegistry: IElementRegistry = modeler.get('elementRegistry');

    const startEvents = elementRegistry.filter((element: IShape) => element.type === 'bpmn:StartEvent');

    return startEvents;
  }

  private async importXmlIntoModeler(modeler: IBpmnModeler, xml: string): Promise<void> {
    await modeler.importXML(xml);
  }
}
