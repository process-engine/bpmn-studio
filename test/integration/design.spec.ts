import {TestClient} from './TestClient';
import {applicationArgs} from './get-application-args';

async function createAndOpenDiagram(): Promise<void> {
  if (!creatingFirstDiagram) {
    await testClient.openStartPage();
  }

  await testClient.createAndOpenNewDiagram();
}

let testClient: TestClient;
let creatingFirstDiagram: boolean = true;

describe('Design View', function foo() {
  this.slow(10000);
  this.timeout(15000);

  beforeEach(async () => {
    testClient = new TestClient(applicationArgs);

    creatingFirstDiagram = true;
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

  it('should save a diagram', async () => {
    // Arrange
    await createAndOpenDiagram();
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

    // if (isWindows) {
    //   await testClient.pause(800);
    // }

    // Act
    await testClient.designView.deployDiagram();
    // Assert
    await testClient.assertTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();
  });

  it('should start a process', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    await testClient.designView.deployDiagram();
    await testClient.assertTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();

    await testClient.designView.startProcess();
  });

  it('should render a diagram correctly', async () => {
    await createAndOpenDiagram();

    await testClient.ensureVisible('[data-element-id="Collaboration_1cidyxu"]');
  });

  it('should select StartEvent after opening a diagram', async () => {
    await createAndOpenDiagram();
    await testClient.showPropertyPanel();

    await testClient.assertSelectedBpmnElementHasName('Start Event');
  });

  it('should select element on click', async () => {
    await createAndOpenDiagram();
    await testClient.showPropertyPanel();

    const elementName = 'End Event';

    await testClient.rejectSelectedBpmnElementHasName(elementName);
    await testClient.clickOnBpmnElementWithName(elementName);
    await testClient.assertSelectedBpmnElementHasName(elementName);
  });
});
