/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import path from 'path';

export class SolutionExplorer {
  private testClient: TestClient;

export class SolutionExplorer extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async show(): Promise<void> {
    const solutionExplorerIsVisible = await this.webdriverClient.isVisible('[data-test-solution-explorer-panel]');
    if (solutionExplorerIsVisible) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-solution-explorer]');
    await this.clickOn('[data-test-toggle-solution-explorer]');
    await this.ensureVisible('[data-test-solution-explorer-panel]');
  }

  public async hide(): Promise<void> {
    const solutionExplorerIsVisible = await this.webdriverClient.isVisible('[data-test-solution-explorer-panel]');
    const solutionExplorerIsHidden = !solutionExplorerIsVisible;
    if (solutionExplorerIsHidden) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-solution-explorer]');
    await this.clickOn('[data-test-toggle-solution-explorer]');
    await this.ensureNotVisible('[data-test-solution-explorer-panel]');
  }

  public async assertInternalProcessEngineIsOpenedAsSolution(): Promise<void> {
    await this.ensureVisible('[data-test-solution-is-internal=true]');
  }

  public async openDirectoryAsSolution(dir: string, diagramName?: string): Promise<void> {
    const pathToSolution: string = path.join(__dirname, '..', '..', '..', dir);

    await this.webdriverClient.executeAsync(
      async (solutionPath, solutionIdentity, done) => {
        // eslint-disable-next-line no-underscore-dangle
        await (window as any).__dangerouslyInvoke.openSolution(solutionPath, false, solutionIdentity);

        done();
      },
      pathToSolution,
      this.getDefaultIdentity(),
    );

    await this.ensureVisible(`[data-test-solution-entry-name=${dir}]`);

    if (diagramName) {
      const diagramUri = this.getUriForSelector(pathToSolution, diagramName);
      await this.ensureVisible(`[data-test-open-diagram-with-uri*="${diagramUri}"]`);
      await this.clickOn(`[data-test-open-diagram-with-uri*="${diagramUri}"]`);
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
