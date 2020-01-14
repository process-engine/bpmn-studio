import {TestClient} from './TestClient';
import {applicationArgs} from './modules/get-application-args';

const VISIBLE_TIMEOUT = 40000;
let testClient: TestClient;

describe('Design View', function foo() {
  this.slow(10000);
  this.timeout(15000);

  beforeEach(async () => {
    testClient = new TestClient(applicationArgs);

    testClient.creatingFirstDiagram = true;
    await testClient.startSpectronApp();
    await testClient.awaitReadiness();
    await testClient.startRecording();
  });

  afterEach(
    async (): Promise<void> => {
      if (await testClient.isSpectronAppRunning()) {
        const fileName = this.ctx.currentTest.title.replace(/\s/g, '-');

        if (this.ctx.currentTest.state === 'failed') {
          await testClient.stopRecordingAndSave(`test-results/${fileName}.webm`);
        } else {
          await testClient.stopRecording();
        }

        await testClient.stopSpectronApp();
        await testClient.clearDatabase();
        await testClient.clearSavedDiagrams();
      }
    },
  );

  this.afterAll(async () => {
    await testClient.removeTestsFolder();
  });

  it('should save a diagram', async () => {
    // Arrange
    await testClient.createAndOpenNewDiagram();
    await testClient.assertDiagramIsUnsaved();

    // Act and Assert
    await testClient.designView.saveDiagramAs('test1.bpmn');
    await testClient.assertDiagramIsSaved();
  });

  it('should deploy a diagram', async () => {
    // Arrange
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    // Act
    await testClient.designView.deployDiagram();
    // Assert
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();
  });

  it('should start a process', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();

    await testClient.designView.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();

    await testClient.designView.startProcess();
  });

  it('should render a diagram correctly', async () => {
    await testClient.createAndOpenNewDiagram();

    await testClient.ensureVisible('[data-element-id="Collaboration_1cidyxu"]', VISIBLE_TIMEOUT);
  });

  it.skip('should select a StartEvent after opening a diagram', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.showPropertyPanel();

    await testClient.assertSelectedBpmnElementHasName('Start Event');
  });

  it.skip('should select a element the user clicks on', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.showPropertyPanel();

    const elementName = 'End Event';

    await testClient.rejectSelectedBpmnElementHasName(elementName);
    await testClient.clickOnBpmnElementWithName(elementName);
    await testClient.assertSelectedBpmnElementHasName(elementName);
  });

  it('should open the xml view from the status bar', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlViewFromStatusbar();
    await testClient.designView.assertXmlViewIsVisible();
  });

  it('should open design view from the status bar', async () => {
    // Arrange
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlViewFromStatusbar();

    // Act and Assert
    await testClient.designView.openDetailViewFromStatusbar();
  });
});
