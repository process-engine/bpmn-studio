import {bindable, inject} from 'aurelia-framework';
import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import {EventAggregator} from 'aurelia-event-aggregator';
import {SolutionService} from '../../services/solution-service/solution.service';
import {FeedbackData, ISolutionEntry} from '../../contracts';
import environment from '../../environment';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';
import {solutionIsRemoteSolution} from '../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';

interface IShowSolutionList {
  [solutionName: string]: boolean;
}

interface ISelectedDiagramList {
  [diagramUri: string]: boolean;
}

@inject(EventAggregator, 'SolutionService')
export class FeedbackModal {
  @bindable public showFeedbackModal: boolean;

  public bugs: string = '';
  public suggestions: string = '';
  public selectedDiagrams: ISelectedDiagramList = {};
  public additionalDiagramInformation: string = '';
  public attachInternalDatabases: boolean = false;

  public solutions: Array<ISolution>;
  public showSolutionList: IShowSolutionList = {};
  public showProcessModelSelection: boolean;

  private solutionService: SolutionService;
  private ipcRenderer: any;

  constructor(eventAggregator: EventAggregator, solutionService: SolutionService) {
    this.solutionService = solutionService;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }

    eventAggregator.subscribe(environment.events.showFeedbackModal, (show: boolean): void => {
      this.showFeedbackModal = show;
    });
  }

  public showFeedbackModalChanged(): void {
    if (this.showFeedbackModal) {
      this.updateSolutions();
    }
  }

  public sendFeedback(): void {
    const diagramsToAttach: Array<IDiagram> = Object.keys(this.selectedDiagrams).map((diagramUri: string) => {
      for (const solution of this.solutions) {
        const diagramSearchResult = solution.diagrams.find((diagram: IDiagram) => {
          return diagram.uri === diagramUri;
        });

        const diagramFound: boolean = diagramSearchResult !== undefined;
        if (diagramFound) {
          return diagramSearchResult;
        }
      }

      return undefined;
    });

    const feedbackData: FeedbackData = {
      bugs: this.bugs,
      suggestions: this.suggestions,
      diagrams: diagramsToAttach,
      additionalDiagramInformation: this.additionalDiagramInformation,
      attachInternalDatabases: this.attachInternalDatabases,
    };

    this.ipcRenderer.send('create-feedback-zip', feedbackData);

    this.showFeedbackModal = false;

    this.cleanupInputs();
  }

  public abort(): void {
    this.showFeedbackModal = false;

    this.cleanupInputs();
  }

  public toggleSolutionVisiblity(solutionName): void {
    this.showSolutionList[solutionName] = !this.showSolutionList[solutionName];
  }

  private async updateSolutions(): Promise<void> {
    const solutionEntries: Array<ISolutionEntry> = this.solutionService.getAllSolutionEntries();

    this.solutions = [];

    solutionEntries.forEach(
      async (solutionEntry: ISolutionEntry): Promise<void> => {
        const solution: ISolution = await solutionEntry.service.loadSolution();

        const solutionContainsDiagrams: boolean = solution.diagrams.length > 0;
        if (solutionContainsDiagrams) {
          this.solutions.push(solution);

          this.solutions.sort(this.sortSolutionFunction);

          this.showSolutionList[solution.name] = true;
        }
      },
    );
  }

  private sortSolutionFunction = (solutionA: ISolution, solutionB: ISolution): number => {
    if (solutionA.uri === 'about:open-diagrams') {
      return -1;
    }

    if (solutionB.uri === 'about:open-diagrams') {
      return 1;
    }

    const solutionAIsRemoteSolution: boolean = solutionIsRemoteSolution(solutionA.uri);
    const solutionBIsRemoteSolution: boolean = solutionIsRemoteSolution(solutionB.uri);
    if (solutionAIsRemoteSolution !== solutionBIsRemoteSolution) {
      return solutionAIsRemoteSolution ? 1 : -1;
    }

    return solutionA.name < solutionB.name ? -1 : 1;
  };

  private cleanupInputs(): void {
    this.attachInternalDatabases = false;
    this.suggestions = '';
    this.bugs = '';
    this.additionalDiagramInformation = '';
    this.selectedDiagrams = {};
    this.showSolutionList = {};
    this.showProcessModelSelection = false;
  }
}
