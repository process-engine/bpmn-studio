import {Application} from 'spectron';
import path from 'path';

import {TestClient} from './TestClient';

const isWindows = process.platform === 'win32';
const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);

function getApplicationArgs(givenPath: string | null): any {
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
  const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronExecutable);
  const electronBundlePath = path.join(__dirname, '..', '..', 'electron_app', 'electron.js');

  return {...commonArgs, path: electronPath, args: [electronBundlePath]};
}

async function createAndOpenDiagram(): Promise<void> {
  if (!creatingFirstDiagram) {
    await testClient.openStartPage();
  }

  await testClient.ensureVisible('[data-test-create-new-diagram]');
  await testClient.clickOn('[data-test-create-new-diagram]');
  await testClient.ensureVisible('.process-details-title');
}

let app: Application;
let testClient: TestClient;

let creatingFirstDiagram: boolean = true;

describe('Application launch', function foo() {
  this.slow(10000);
  this.timeout(15000000);

  beforeEach(async () => {
    app = new Application(applicationArgs);
    testClient = new TestClient(app);

    creatingFirstDiagram = true;
    await app.start();
    await testClient.awaitReadyness();
  });

  afterEach(async () => {
    await testClient.clearDatabase();
    if (app && app.isRunning()) {
      return app.stop();
    }
    return null;
  });

  this.afterAll(async () => {
    await testClient.clearSavedDiagrams();
  });

  it('should start the application', async () => {
    await app.client.waitUntilTextExists('h3', 'Welcome');

    await testClient.assertWindowTitleIs('Start Page | BPMN Studio');
  });

  it('should create and open a new diagram by clicking on new diagram link', async () => {
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
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

  it('should create and open a second diagram', async () => {
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');

    creatingFirstDiagram = false;
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-2');
  });

  it('should open detail view', async () => {
    await createAndOpenDiagram();
    await testClient.openStartPage();

    await testClient.openDesignViewForDiagram(
      'Untitled-1',
      'about:open-diagrams/Untitled-1.bpmn',
      'about:open-diagrams',
    );
  });

  it('should open XML view', async () => {
    await createAndOpenDiagram();

    await testClient.openXmlViewForDiagram('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
  });

  it('should open diff view', async () => {
    await createAndOpenDiagram();

    await testClient.openDiffViewForDiagram('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
  });

  it('should open the xml view from the status bar', async () => {
    await createAndOpenDiagram();
    await testClient.openXmlViewFromStatusbar();
  });

  it('should open design view from the status bar', async () => {
    await createAndOpenDiagram();

    await testClient.openXmlViewFromStatusbar();
    await testClient.openDesignViewFromStatusbar();
  });

  it('should open a solution', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    await testClient.openDirectoryAsSolution('fixtures');
    await testClient.ensureVisible('.solution-entry__solution-name=fixtures');
  });

  it('should create and open a new diagam by clicking on new diagram link', async () => {
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
  });

  it('should render a diagram correctly', async () => {
    await createAndOpenDiagram();

    await testClient.ensureVisible('[data-element-id="Collaboration_1cidyxu"]');
  });

  it('should select StartEvent after opening a diagram', async () => {
    await createAndOpenDiagram();
    await testClient.showPropertyPanel();

    await testClient.assertSelectedBPMNElementHasName('Start Event');
  });

  it('should select element on click', async () => {
    await createAndOpenDiagram();
    await testClient.showPropertyPanel();

    const elementName = 'End Event';

    await testClient.rejectSelectedBpmnElementHasName(elementName);
    await testClient.clickOnBpmnElementWithName(elementName);
    await testClient.assertSelectedBpmnElementHasName(elementName);
  });

  it('should create and open a second diagram', async () => {
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-1');
    await testClient.assertWindowTitleIs('Design | BPMN Studio');

    creatingFirstDiagram = false;
    await createAndOpenDiagram();

    await testClient.assertNavbarTitleIs('Untitled-2');
  });

  it('should open detail view', async () => {
    await createAndOpenDiagram();
    await testClient.openStartPage();

    await testClient.openDesignViewForDiagram(
      'Untitled-1',
      'about:open-diagrams/Untitled-1.bpmn',
      'about:open-diagrams',
    );
  });

  it('should open XML view', async () => {
    await createAndOpenDiagram();

    await testClient.openXmlViewForDiagram('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
  });

  it('should open diff view', async () => {
    await createAndOpenDiagram();

    await testClient.openDiffViewForDiagram('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
  });

  it('should open the xml view from the status bar', async () => {
    await createAndOpenDiagram();
    await testClient.openXmlViewFromStatusbar();
  });

  it('should open design view from the status bar', async () => {
    await createAndOpenDiagram();

    await testClient.openXmlViewFromStatusbar();
    await testClient.openDesignViewFromStatusbar();
  });

  it('should open a solution', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    await testClient.openDirectoryAsSolution('fixtures');
  });

  it('should open a diagram from solution', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    const diagramName = 'call_activity_subprocess_error';
    await testClient.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertNavbarTitleIs(diagramName);
  });

  it('should start a ProcessEngine', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    await testClient.assertInternalProcessEngineHasStarted();
  });

  it('should show the SolutionExplorer', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    await testClient.hideSolutionExplorer();
    await testClient.showSolutionExplorer();
  });

  it('should hide the SolutionExplorer', async () => {
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');

    await testClient.hideSolutionExplorer();
  });

  it('should open the Think view', async () => {
    await createAndOpenDiagram();

    await testClient.openThinkView('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await testClient.assertWindowTitleIs('Think | BPMN Studio');
  });

  it('should open the Think view from navbar', async () => {
    await createAndOpenDiagram();

    await testClient.openThinkViewFromNavbar();
    await testClient.assertWindowTitleIs('Design | BPMN Studio');
  });

  it('should save a diagram', async () => {
    await createAndOpenDiagram();

    await testClient.assertDiagramIsUnsaved();
    await testClient.saveDiagramAs('test1.bpmn');
    await testClient.assertDiagramIsSaved();
  });

  it('should deploy a diagram', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');
    await testClient.openDirectoryAsSolution('fixtures', diagramName);

    await testClient.assertDiagramIsOnFileSystem();
    await testClient.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();
  });

  it('should start a process', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');
    await testClient.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    await testClient.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();

    await testClient.startProcess();
  });

  it('should stop a process on LiveExecutionTracker', async () => {
    const diagramName = 'receive_task_wait_test';
    await testClient.ensureVisible('h3=Welcome to BPMN Studio!');
    await testClient.openDirectoryAsSolution('fixtures', diagramName);
    await testClient.assertDiagramIsOnFileSystem();
    await testClient.deployDiagram();
    await testClient.assertNavbarTitleIs(diagramName);
    await testClient.assertDiagramIsOnProcessEngine();

    await testClient.startProcess();
    await testClient.stopProcess();
  });
});
