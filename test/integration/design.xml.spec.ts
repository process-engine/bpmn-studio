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
  this.timeout(40000);

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
