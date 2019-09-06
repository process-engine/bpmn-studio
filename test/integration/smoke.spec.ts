import {TestClient} from './TestClient';
import {applicationArgs} from './modules/get-application-args';

let testClient: TestClient;

describe('Application launch', function foo() {
  this.slow(10000);
  this.timeout(15000);

  beforeEach(async () => {
    testClient = new TestClient(applicationArgs);

    testClient.creatingFirstDiagram = true;
    await testClient.startSpectronApp();
    await testClient.awaitReadyness();
  });

  afterEach(async () => {
    if (await testClient.isSpectronAppRunning()) {
      await testClient.stopSpectronApp();
      return testClient.clearDatabase();
    }
    return null;
  });

  this.afterAll(async () => {
    await testClient.clearSavedDiagrams();
  });

  it('should start the application', async () => {
    await testClient.elementHasText('h3', 'Welcome');

    await testClient.assertWindowTitleIs('Start Page | BPMN Studio');
  });

  it('should create and open a new diagram by clicking on new diagram link', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
  });

  it('should create and open a second diagram', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');

    testClient.creatingFirstDiagram = false;
    await testClient.createAndOpenNewDiagram();

    await testClient.assertNavbarTitleIs('Untitled-2');
  });

  it('should open detail view', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.openStartPage();

    await testClient.designView.openDetailView(
      'Untitled-1',
      'about:open-diagrams/Untitled-1.bpmn',
      'about:open-diagrams',
    );

    await testClient.assertCanvasModelIsVisible();
  });

  it('should open XML view', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlView('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await testClient.designView.assertXmlViewIsVisible();
  });

  it('should open diff view', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.designView.openDiffView(
      'Untitled-1',
      'about:open-diagrams/Untitled-1.bpmn',
      'about:open-diagrams',
    );

    await testClient.assertDiffViewHasRenderedAllContainer();
  });

  it('should open the Think view', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.openThinkView('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should open the Think view from navbar', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.openThinkView();
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should stop a process on LiveExecutionTracker', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    await testClient.designView.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();
    await testClient.designView.startProcess();

    await testClient.liveExecutionTracker.stopProcess();
  });
});
