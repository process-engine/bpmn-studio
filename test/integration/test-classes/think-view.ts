/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';

export class ThinkView {
  private testClient: TestClient;

export class ThinkView extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async open(diagramName?: string, diagramUri?: string, solutionUri?: string): Promise<void> {
    if (diagramName && diagramUri) {
      const encodedName = encodeURIComponent(diagramName);
      const encodedUri = encodeURIComponent(diagramUri);
      const encodedSolutionUri = solutionUri ? encodeURIComponent(solutionUri) : '';
      const uriFragment = `#/think/diagram-list/diagram/${encodedName}?diagramUri=${encodedUri}&solutionUri=${encodedSolutionUri}`;

      await this.openView(uriFragment);
    } else {
      await this.openView('#/think/diagram-list/diagram');
    }

    await this.ensureVisible('diagram-list');
  }
}
