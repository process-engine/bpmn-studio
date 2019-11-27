import path from 'path';
import {TestClient} from '../TestClient';
import {callExposedFunction} from '../../../src/services/expose-functionality-module/expose-functionality.module';

export class SolutionExplorer {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async show(): Promise<void> {
    const solutionExplorerIsVisible = await this.testClient.webdriverClient.isVisible(
      '[data-test-solution-explorer-panel]',
    );
    if (solutionExplorerIsVisible) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-solution-explorer]', 40000);
    await this.testClient.clickOn('[data-test-toggle-solution-explorer]');
    await this.testClient.ensureVisible('[data-test-solution-explorer-panel]', 40000);
  }

  public async hide(): Promise<void> {
    const solutionExplorerIsVisible = await this.testClient.webdriverClient.isVisible(
      '[data-test-solution-explorer-panel]',
    );
    const solutionExplorerIsHidden = !solutionExplorerIsVisible;
    if (solutionExplorerIsHidden) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-solution-explorer]', 40000);
    await this.testClient.clickOn('[data-test-toggle-solution-explorer]');
    await this.testClient.ensureNotVisible('[data-test-solution-explorer-panel]');
  }

  public async assertInternalProcessEngineIsOpenedAsSolution(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-solution-is-internal=true]', 40000);
  }

  public async openDirectoryAsSolution(dir: string, diagramName?: string): Promise<void> {
    const pathToSolution: string = path.join(__dirname, '..', '..', '..', '..', '..', dir);

    await callExposedFunction(
      this.testClient.webdriverClient,
      'openSolution',
      pathToSolution,
      false,
      this.testClient.getDefaultIdentity(),
    );

    await this.testClient.ensureVisible(`[data-test-solution-entry-name=${dir}]`, 40000);

    if (diagramName) {
      const diagramUri = this.getUriForSelector(pathToSolution, diagramName);
      await this.testClient.ensureVisible(`[data-test-open-diagram-with-uri*="${diagramUri}"]`, 40000);
      await this.testClient.clickOn(`[data-test-open-diagram-with-uri*="${diagramUri}"]`);
    }
  }

  private getUriForSelector(pathToSolution: string, diagramName: string): string {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const searchString: string = `${pathToSolution}\\${diagramName}`;
      const replacedSearchString = searchString.replace(/[\\]/gm, '\\\\');

      return replacedSearchString;
    }

    return `${pathToSolution}/${diagramName}`;
  }
}
