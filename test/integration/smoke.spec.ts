import {TestClient} from './TestClient';
import {applicationArgs} from './modules/get-application-args';

const VISIBLE_TIMEOUT = 40000;
let testClient: TestClient;

async function stopProcess(): Promise<void> {
  await testClient.ensureVisible('[data-test-stop-process-button]', VISIBLE_TIMEOUT);
  await testClient.clickOn('[data-test-stop-process-button]');
  await testClient.ensureNotVisible('[data-test-stop-process-button]');
}

describe('Application launch', function foo() {
  this.slow(10000);
  this.timeout(15000);

  beforeEach(async () => {
    testClient = new TestClient(applicationArgs);

    testClient.creatingFirstDiagram = true;
    await testClient.startSpectronApp();
    await testClient.awaitReadiness();

    (this as any).filePath = testClient.getVideoFilePathForTest(this.ctx.currentTest);
    await testClient.startRecording((this as any).filePath);
  });

  afterEach(
    async (): Promise<void> => {
      if (await testClient.isSpectronAppRunning()) {
        if (this.ctx.currentTest.state === 'failed') {
          await testClient.stopRecordingAndSave();
        }

        await testClient.stopSpectronApp();

        if (this.ctx.currentTest.state !== 'failed') {
          await testClient.removeUnneededVideos((this as any).filePath);
        }
        await testClient.clearDatabase();
        await testClient.clearSavedDiagrams();
      }
    },
  );

  this.afterAll(async () => {
    await testClient.removeTestsFolder();
  });

  it('should start the application', async () => {
    await testClient.elementHasText('h3', 'Welcome');

    await testClient.assertWindowTitleIs('Start Page | BPMN Studio');
  });

  it('should create and open a new diagram by clicking on the "new diagram" link', async () => {
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

  it('should open the detail view', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.openStartPage();

    await testClient.designView.openDetailView(
      'Untitled-1',
      'about:open-diagrams/Untitled-1.bpmn',
      'about:open-diagrams',
    );

    await testClient.assertCanvasModelIsVisible();
  });

  it('should open the XML view', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlView('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await testClient.designView.assertXmlViewIsVisible();
  });

  it('should open the diff view', async () => {
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

    await testClient.openThinkViewFromNavbar();
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should stop a process from the LiveExecutionTracker', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    await testClient.designView.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();
    await testClient.designView.startProcess();

    await stopProcess();
  });
});
