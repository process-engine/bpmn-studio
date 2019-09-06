import assert from 'assert';
import {TestClient} from './TestClient';
import {applicationArgs} from './modules/get-application-args';

async function assertXmlViewHasContent(): Promise<void> {
  await testClient.ensureVisible('[data-test-xml-view-content]');
  const xmlViewContent = await testClient.getTextFromElement('[data-test-xml-view-content]');
  assert.notEqual(xmlViewContent, null);
}

async function assertXmlViewContainsText(text: string): Promise<void> {
  await testClient.ensureVisible('[data-test-xml-view-content]');

  const xmlViewContent = await testClient.getTextFromElement('[data-test-xml-view-content]');
  const xmlViewContentContainsText: boolean = xmlViewContent.includes(text);

  assert.equal(xmlViewContentContainsText, true);
}

let testClient: TestClient;

describe('XML View', function foo() {
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

  it('should has content', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlView('Untitled-1', 'about:open-diagrams/Untitled-1.bpmn', 'about:open-diagrams');
    await assertXmlViewHasContent();
  });

  it('should contain text', async () => {
    await testClient.createAndOpenNewDiagram();
    await testClient.designView.openXmlViewFromStatusbar();
    await assertXmlViewContainsText('id="Untitled-1"');
  });
});
