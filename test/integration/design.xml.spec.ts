import assert from 'assert';
import {TestClient} from './TestClient';
import {applicationArgs} from './modules/get-application-args';

const VISIBLE_TIMEOUT = 40000;

async function assertXmlViewHasContent(): Promise<void> {
  await testClient.ensureVisible('[data-test-xml-view-content]', VISIBLE_TIMEOUT);
  const xmlViewContent = await testClient.getTextFromElement('[data-test-xml-view-content]');
  assert.notEqual(xmlViewContent, null);
}

async function assertXmlViewContainsText(text: string): Promise<void> {
  await testClient.ensureVisible('[data-test-xml-view-content]', VISIBLE_TIMEOUT);

  const xmlViewContent = await testClient.getTextFromElement('[data-test-xml-view-content]');
  const xmlViewContentContainsText: boolean = xmlViewContent.includes(text);

  assert.equal(xmlViewContentContainsText, true);
}

let testClient: TestClient;

describe('XML View', function foo() {
  this.slow(10000);
  this.timeout(20000);

  beforeEach(async () => {
    testClient = new TestClient(applicationArgs);

    await testClient.clearDatabase();
    await testClient.clearSavedDiagrams();
    testClient.creatingFirstDiagram = true;
    await testClient.startSpectronApp();
    await testClient.awaitReadiness();
  });

  afterEach(
    async (): Promise<void> => {
      if (await testClient.isSpectronAppRunning()) {
        await testClient.stopSpectronApp();
      }
    },
  );

  this.afterAll(async () => {
    await testClient.clearDatabase();
    await testClient.clearSavedDiagrams();
    await testClient.rmeoveTestsFolder();
  });

  it('should have content', async () => {
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
