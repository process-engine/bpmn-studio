import {Application} from 'spectron';
import assert from 'assert';
import path from 'path';

import {TestClient} from './TestClient';

const isWindows = process.platform === 'win32';
const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);

function getApplicationArgs(givenPath: string | null): any {
  const commonArgs = {requireName: 'nodeRequire'};

  if (givenPath != null) {
    console.log(`Using path: ${givenPath}`);
    return {...commonArgs, path: givenPath};
  }

  const electronExecutable = isWindows ? 'electron.cmd' : 'electron';
  const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronExecutable);
  const electronBundlePath = path.join(__dirname, '..', '..', 'electron_app', 'electron.js');

  return {...commonArgs, path: electronPath, args: [electronBundlePath]};
}

describe('Application launch', function foo() {
  this.timeout(10000);

  beforeEach(async function bar() {
    this.app = new Application(applicationArgs);
    this.testClient = new TestClient(this.app);

    await this.app.start();
    await this.testClient.awaitReadyness();
  });

  afterEach(function baz() {
    console.log('afterEach');
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
    return null;
  });

  it('shows something', async function test1() {
    const callback = (resolve: Function, reject: Function): void => {
      this.app.client
        .waitUntilTextExists('h3', 'Welcome')
        .then(async () => {
          const isVisible = await this.app.browserWindow.isVisible();
          assert.equal(isVisible, true);
        })
        .then(async () => {
          const title = await this.app.client.getTitle();
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
});
