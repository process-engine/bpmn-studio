import path from 'path';

import {AppConstructorOptions} from 'spectron';
import {TestClient} from './TestClient';

const isWindows = process.platform === 'win32';
const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);

function getApplicationArgs(givenPath: string | null): AppConstructorOptions {
  const commonArgs = {
    requireName: 'nodeRequire',
    env: {
      SPECTRON_TESTS: true,
    },
    webdriverOptions: {
      deprecationWarnings: false,
    },
  };

  if (givenPath != null) {
    console.log(`Using path: ${givenPath}`);
    return {...commonArgs, path: givenPath};
  }

  const electronExecutable = isWindows ? 'electron.cmd' : 'electron';
  const electronPath = path.join(__dirname, '..', '..', '..', '..', 'node_modules', '.bin', electronExecutable);
  const electronBundlePath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'dist',
    'electron_app',
    'electron_app',
    'electron.js',
  );

  return {...commonArgs, path: electronPath, args: [electronBundlePath]};
}

async function createAndOpenDiagram(): Promise<void> {
  if (!creatingFirstDiagram) {
    await testClient.startPage.open();
  }

  await testClient.startPage.createAndOpenNewDiagram();
}

let testClient: TestClient;

let creatingFirstDiagram: boolean = true;

describe('Application launch', function foo() {
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

  it('should start the application', async () => {
    await testClient.elementHasText('h3', 'Welcome');

    await testClient.assertWindowTitleIs('Start Page | BPMN Studio');
  });

  it('should create and open a new diagram by clicking on new diagram link', async () => {
    await createAndOpenDiagram();

    await testClient.navbar.assertTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
  });

  it('should render a diagram correctly', async () => {
    await createAndOpenDiagram();

    await testClient.ensureVisible('[data-element-id="Collaboration_1cidyxu"]');
  });

  it('should select StartEvent after opening a diagram', async () => {
    await createAndOpenDiagram();
    await testClient.propertyPanel.show();

    await testClient.propertyPanel.assertSelectedBpmnElementHasName('Start Event');
  });

  it('should select element on click', async () => {
    await createAndOpenDiagram();
    await testClient.propertyPanel.show();

    const elementName = 'End Event';

    await testClient.propertyPanel.rejectSelectedBpmnElementHasName(elementName);
    await testClient.designView.clickOnBpmnElementWithName(elementName);
    await testClient.propertyPanel.assertSelectedBpmnElementHasName(elementName);
  });

  it('should create and open a second diagram', async () => {
    await createAndOpenDiagram();

    await testClient.navbar.assertTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');

    creatingFirstDiagram = false;
    await createAndOpenDiagram();

    await testClient.navbar.assertTitleIs('Untitled-2');
  });

  it('should open detail view', async () => {
    await createAndOpenDiagram();
    await testClient.startPage.open();

    await testClient.designView.open('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');

    await testClient.designView.assertCanvasModelIsVisible();
  });

  it('should open XML view', async () => {
    await createAndOpenDiagram();

    await testClient.xmlView.open('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');

    await testClient.xmlView.hasContent();
  });

  it('should open diff view', async () => {
    await createAndOpenDiagram();

    await testClient.diffView.open('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');

    await testClient.diffView.assertHasRenderedAllContainer();
  });

  it('should open the xml view from the status bar', async () => {
    await createAndOpenDiagram();
    await testClient.statusbar.openXmlView();
    await testClient.xmlView.assertContainsText('id="Untitled-1"');
  });

  it('should open design view from the status bar', async () => {
    // Arrange
    await createAndOpenDiagram();
    await testClient.statusbar.openXmlView();

    // Act and Assert
    await testClient.statusbar.openDesignView();
  });

  it('should create and open a new diagam by clicking on new diagram link', async () => {
    await createAndOpenDiagram();

    await testClient.navbar.assertTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
  });

  it('should open a solution', async () => {
    await testClient.startPageLoaded();

    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures');
  });

  it('should open a diagram from solution', async () => {
    await testClient.startPageLoaded();

    const diagramName = 'call_activity_subprocess_error';
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.navbar.assertTitleIs(diagramName);
  });

  it('should open the internal ProcessEngine as solution', async () => {
    await testClient.startPageLoaded();

    await testClient.solutionExplorer.assertInternalProcessEngineIsOpenedAsSolution();
  });

  it('should show the SolutionExplorer', async () => {
    // Arrange
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.hide();

    // Act and Assert
    await testClient.solutionExplorer.show();
  });

  it('should hide the SolutionExplorer', async () => {
    await testClient.startPageLoaded();

    await testClient.solutionExplorer.hide();
  });

  it('should open the Think view', async () => {
    await createAndOpenDiagram();

    await testClient.thinkView.open('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should open the Think view from navbar', async () => {
    await createAndOpenDiagram();

    await testClient.navbar.openThinkView();
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should save a diagram', async () => {
    // Arrange
    await createAndOpenDiagram();
    await testClient.navbar.assertDiagramIsUnsaved();

    // Act and Assert
    await testClient.designView.saveDiagramAs('test1.bpmn');
    await testClient.navbar.assertDiagramIsSaved();
  });

  it('should deploy a diagram', async () => {
    // Arrange
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.navbar.assertDiagramIsOnFileSystem();

    if (isWindows) {
      await testClient.pause(800);
    }

    // Act
    await testClient.navbar.deployDiagram();
    // Assert
    await testClient.navbar.assertTitleIs(diagramName);
    await testClient.navbar.assertDiagramIsOnProcessEngine();
  });

  it('should start a process', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.navbar.assertDiagramIsOnFileSystem();
    await testClient.navbar.deployDiagram();
    await testClient.navbar.assertTitleIs(diagramName);
    await testClient.navbar.assertDiagramIsOnProcessEngine();

    await testClient.navbar.startProcess();
  });

  it('should stop a process on LiveExecutionTracker', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.startPageLoaded();
    await testClient.solutionExplorer.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.navbar.assertDiagramIsOnFileSystem();
    await testClient.navbar.deployDiagram();
    await testClient.navbar.assertTitleIs(diagramName);
    await testClient.navbar.assertDiagramIsOnProcessEngine();
    await testClient.navbar.startProcess();

    await testClient.liveExecutionTracker.stopProcess();
  });
});
