import {IIdentity} from '@essential-projects/iam_contracts';
import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {IDiagramValidationService, ISolutionService} from '../../contracts';

/**
 * This service allows to keep all opened single diagrams inside a solution.
 *
 * This is needed because the default solution explorer does not keep state
 * about single diagrams.
 *
 * With this service you can retrieve, all opened single diagrams inside a
 * solution.
 *
 * To remove a diagram from the solution, call use #closeSingleDiagram().
 */

export class SingleDiagramsSolutionExplorerService implements ISolutionExplorerService {

  private _validationService: IDiagramValidationService;
  private _solutionExplorerToOpenDiagrams: ISolutionExplorerService;
  private _uriOfSingleDiagramService: string;
  private _nameOfSingleDiagramService: string;
  private _openedDiagrams: Array<IDiagram> = [];
  private _solutionService: ISolutionService;

  constructor(
    validationService: IDiagramValidationService,
    solutionExplorerToOpenDiagrams: ISolutionExplorerService,
    uriOfSingleDiagramService: string,
    nameOfSingleDiagramService: string,
    solutionService: ISolutionService,
  ) {
    this._validationService = validationService;
    this._solutionExplorerToOpenDiagrams = solutionExplorerToOpenDiagrams;
    this._uriOfSingleDiagramService = uriOfSingleDiagramService;
    this._nameOfSingleDiagramService = nameOfSingleDiagramService;
    this._solutionService = solutionService;
  }

  public getOpenedDiagrams(): Array<IDiagram> {
    return this._openedDiagrams;
  }

  /**
   * Gets the single diagram with the given uri, if the diagram was opened
   * before.
   */
  public getOpenedDiagramByURI(uri: string): IDiagram | null {
    const indexOfDiagram: number = this._findOfDiagramWithURI(uri);

    const diagramWasNotFound: boolean = indexOfDiagram < 0;
    if (diagramWasNotFound) {
      return null;
    }

    const diagramWithURI: IDiagram = this._openedDiagrams[indexOfDiagram];

    return diagramWithURI;
  }

  public openSolution(pathspec: string, identity: IIdentity): Promise<void> {
    return Promise.resolve();
  }

  public loadSolution(): Promise<ISolution> {
    const solution: ISolution = {
      diagrams: this._openedDiagrams,
      name: this._uriOfSingleDiagramService,
      uri: this._nameOfSingleDiagramService,
    };
    return Promise.resolve(solution);
  }

  public async openSingleDiagram(uri: string, identity: IIdentity): Promise<IDiagram> {

    const uriIsNoBpmnFile: boolean = !uri.endsWith('.bpmn');

    if (uriIsNoBpmnFile) {
      throw new Error('File is no BPMN file.');
    }

    const uriAlreadyOpened: boolean = this._findOfDiagramWithURI(uri) >= 0;

    if (uriAlreadyOpened) {
      throw new Error('This diagram is already opened.');
    }

    const lastIndexOfSlash: number = uri.lastIndexOf('/');
    const lastIndexOfBackSlash: number = uri.lastIndexOf('\\');
    const indexBeforeFilename: number = Math.max(lastIndexOfSlash, lastIndexOfBackSlash);

    const filepath: string = uri.substring(0, indexBeforeFilename);

    await this._solutionExplorerToOpenDiagrams.openSolution(filepath, identity);

    const filename: string = uri.replace(/^.*[\\\/]/, '');
    const filenameWithoutEnding: string = filename.replace('.bpmn', '');

    const diagram: IDiagram = await this._solutionExplorerToOpenDiagrams.loadDiagram(filenameWithoutEnding, filepath);

    await this._validationService
      .validate(diagram.xml)
      .isXML()
      .isBPMN()
      .throwIfError();

    this._openedDiagrams.push(diagram);

    return diagram;
  }

  public closeSingleDiagram(diagram: IDiagram): Promise<void> {
    const index: number = this._findOfDiagramWithURI(diagram.uri);

    this._openedDiagrams.splice(index, 1);

    return Promise.resolve();
  }

  public renameDiagram(diagram: IDiagram, newName: string): Promise<IDiagram> {
    throw new Error('Method not supported.');
  }

  public deleteDiagram(diagram: IDiagram): Promise<void> {
    throw new Error('Method not supported.');
  }

  public async loadDiagram(diagramName: string): Promise<IDiagram> {

    const diagramToLoad: IDiagram = this._openedDiagrams.find((diagram: IDiagram) => {
                                      return diagram.name === diagramName;
                                    });

    return diagramToLoad;
  }

  public saveSolution(solution: ISolution, pathspec?: string): Promise<void> {
    throw new Error('Method not supported.');
  }

  public saveDiagram(diagram: IDiagram): Promise<void> {
    this._solutionService.addSingleDiagram(diagram);

    return this._solutionExplorerToOpenDiagrams.saveDiagram(diagram);
  }

  private _findOfDiagramWithURI(uri: string): number {
    const index: number = this._openedDiagrams
      .findIndex((diagram: IDiagram): boolean => {
        return diagram.uri === uri;
    });

    return index;
  }
}
