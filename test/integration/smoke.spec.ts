import {Application} from 'spectron';
import assert from 'assert';
import path from 'path';

import {TestClient} from './TestClient';

const isWindows = process.platform === 'win32';
const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);

function getApplicationArgs(givenPath: string | null): any {
  const commonArgs = {
    requireName: 'nodeRequire',
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
    await app.browserWindow.loadURL(`file://${__dirname}/../../index.html`);
  }

  await testClient.ensureVisible('[data-test-create-new-diagram]');
  await testClient.clickOn('[data-test-create-new-diagram]');
  await testClient.ensureVisible('.process-details-title');
}

let app: Application;
let testClient: TestClient;

let creatingFirstDiagram: boolean = true;

describe('Application launch', function foo() {
  this.timeout(1000000);

  beforeEach(async () => {
    app = new Application(applicationArgs);
    testClient = new TestClient(app);

    creatingFirstDiagram = true;
    await app.start();
    await testClient.awaitReadyness();
  });

  afterEach(() => {
    if (app && app.isRunning()) {
      return app.stop();
    }
    return null;
  });

  it('should start the application', async () => {
    const callback = (resolve: Function, reject: Function): void => {
      app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          const client: any = app.client;
          const title = await client.getTitle();
          assert.equal(title, 'Start Page | BPMN-Studio');
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };

    const result = new Promise(callback);

    return result;
  });

  it('should create and open a new diagam by clicking on new diagram link', async () => {
    const callback = (resolve: Function, reject: Function): void => {
      app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          await createAndOpenDiagram();

          const navbarTitle = await testClient.getTextFromElement('.process-details-title');
          assert.equal(navbarTitle, 'Untitled-1');
        })
        .then(async () => {
          const client: any = app.client;
          const title = await client.getTitle();
          assert.equal(title, 'Design | BPMN-Studio');

          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };

    const result = new Promise(callback);

    return result;
  });

  it('should render a diagram correctly', async () => {
    const callback = (resolve: Function, reject: Function): void => {
      app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          await createAndOpenDiagram();

          await testClient.ensureVisible('[data-element-id="Collaboration_1cidyxu"]');

          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };

    const result = new Promise(callback);

    return result;
  });

  it('should select StartEvent after opening a diagram', async () => {
    const callback = (resolve: Function, reject: Function): void => {
      app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          await createAndOpenDiagram();
          await testClient.ensureVisible('property-panel');

          const selectedElementText = await testClient.getValueFromElement('#elementId');

          assert.equal(selectedElementText, 'StartEvent_1mox3jl');

          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };

    const result = new Promise(callback);

    return result;
  });

  it('should select EndEvent after selecting the StartEvent', async () => {
    const callback = (resolve: Function, reject: Function): void => {
      app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          await createAndOpenDiagram();
          await testClient.ensureVisible('property-panel');

          let selectedElementText;
          const endEventId = 'EndEvent_0eie6q6';

          selectedElementText = await testClient.getValueFromElement('#elementId');
          assert.equal(selectedElementText, 'StartEvent_1mox3jl');

          await testClient.clickOn(`[data-element-id="${endEventId}"]`);

          selectedElementText = await testClient.getValueFromElement('#elementId');
          assert.equal(selectedElementText, endEventId);

          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    };

    const result = new Promise(callback);

    return result;
  });

  it('should create and open a second diagram', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        let navbarTitle;

        try {
          await app.client.waitUntilTextExists('h3', 'Welcome');

          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();

          navbarTitle = await testClient.getTextFromElement('.process-details-title');
          assert.equal(navbarTitle, 'Untitled-1');

          const client: any = app.client;
          const title = await client.getTitle();
          assert.equal(title, 'Design | BPMN-Studio');

          creatingFirstDiagram = false;
          await createAndOpenDiagram();

          navbarTitle = await testClient.getTextFromElement('.process-details-title');
          assert.equal(navbarTitle, 'Untitled-2');

          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  it('should navigate to detail view', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          await app.client.waitUntilTextExists('h3', 'Welcome');

          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();
          await testClient.navigateToStartPage();

          await testClient.navigateToDetailView(
            'Untitled-1',
            'about:open-diagrams/Untitled-1.bpmn',
            'about:open-diagrams',
          );

          await testClient.ensureVisible('diagram-detail');
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  it('should navigate to XML view', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();
          await testClient.navigateToStartPage();

          await testClient.navigateToXMLView(
            'Untitled-1',
            'about:open-diagrams/Untitled-1.bpmn',
            'about:open-diagrams',
          );

          await testClient.ensureVisible('bpmn-xml-view');
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  it('should navigate to diff view', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();
          await testClient.navigateToStartPage();

          await testClient.navigateToDiffView(
            'Untitled-1',
            'about:open-diagrams/Untitled-1.bpmn',
            'about:open-diagrams',
          );

          await testClient.ensureVisible('bpmn-diff-view');
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  it('should show the XML view after clicking on the button in the status bar', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();
          await testClient.ensureVisible('[data-test-status-bar-xml-view-button]');

          await testClient.clickOn('[data-test-status-bar-xml-view-button]');
          await testClient.ensureVisible('bpmn-xml-view');
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });

  it('should switch from XML view to detail view, after clicking on the button in the status bar', async () => {
    return new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const isVisible = await app.browserWindow.isVisible();
          assert.equal(isVisible, true);

          await createAndOpenDiagram();
          await testClient.clickOn('[data-test-status-bar-xml-view-button]');

          await testClient.ensureVisible('[data-test-status-bar-disable-xml-view-button]');
          await testClient.clickOn('[data-test-status-bar-disable-xml-view-button]');
          await testClient.ensureVisible('diagram-detail');
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    );
  });
});
