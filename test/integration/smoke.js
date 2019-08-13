/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable semi */
/* eslint-disable func-names */
const {Application} = require('spectron');
const assert = require('assert');
const path = require('path');
const {describe} = require('mocha');

const electron = require('electron');
const {TestClient} = require('../../dist/test/TestClient');

const isWindows = process.platform === 'win32';
const applicationArgs = getApplicationArgs(process.env.SPECTRON_APP_PATH);

function getApplicationArgs(givenPath) {
  if (givenPath != null) {
    console.log(`Using path: ${givenPath}`);
    return {path: givenPath};
  }

  const electronExecutable = isWindows ? 'electron.cmd' : 'electron';
  const electronPathTwo = path.join(
    __dirname,
    '..',
    '..',
    'dist',
    'electron',
    'BPMN Studio.app',
    'Contents',
    'MacOS',
    'BPMN Studio',
  );
  const electronBundlePath = path.join(__dirname, '..', '..', 'electron_app', 'electron.js');

  return {path: electronPathTwo, args: [electronBundlePath]};
}

describe('Application launch', function () {
  this.timeout(10000);

  beforeEach(async function () {
    this.app = new Application(applicationArgs);
    this.testClient = new TestClient(this.app);

    await this.app.start();
    await this.testClient.awaitReadyness();
  });

  afterEach(function () {
    console.log('afterEach');
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
    return null;
  });

  it('shows something', async function () {
    // const callback = (resolve: Function, reject: Function): void => {
    this.app.client
      .waitUntilTextExists('h3', 'Welcome')
      .then(async () => {
        console.log(this.app);
        const isVisible = await this.app.browserWindow.isVisible();
        assert.equal(isVisible, true);
      })
      .then(async () => {
        const title = await this.app.client.getTitle();
        assert.equal(title, 'Charon 2.0');
        // resolve();
      })
      .catch((error) => {
        // reject(error);
      });
    // };

    // const result = new Promise(callback);

    // await result;
  });
});
