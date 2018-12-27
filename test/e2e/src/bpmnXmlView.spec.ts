import {
  browser,
  ElementFinder,
  protractor,
  ProtractorExpectedConditions,
} from 'protractor';

import {BpmnIo} from './pages/bpmn-io';
import {BpmnXmlView} from './pages/bpmnXmlView';
import {General} from './pages/general';
import {NavBar} from './pages/navBar';
import {ProcessModel} from './pages/processModel';
import {SolutionExplorer} from './pages/solutionExplorer';
import {StatusBar} from './pages/statusBar';

describe('bpmn-io XML view', () => {

  let bpmnIo: BpmnIo;
  let bpmnXmlView: BpmnXmlView;
  let general: General;
  let navBar: NavBar;
  let processModel: ProcessModel;
  let solutionExplorer: SolutionExplorer;
  let statusBar: StatusBar;

  let processModelId: string;

  const aureliaUrl: string = browser.params.aureliaUrl;
  const defaultTimeoutMS: number = browser.params.defaultTimeoutMS;

  const expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  beforeAll(() => {
    bpmnIo = new BpmnIo();
    bpmnXmlView = new BpmnXmlView();
    general = new General();
    navBar = new NavBar();
    processModel = new ProcessModel();
    solutionExplorer = new SolutionExplorer();
    statusBar = new StatusBar();

    processModelId = processModel.getProcessModelId();

    // Create a new process definition by POST REST call
    processModel.postProcessModelWithUserTask(processModelId);
  });

  afterAll(async() => {

    await processModel.deleteProcessModel();
  });

  beforeEach(async() => {
    const getRouterViewContainer: ElementFinder = general.getRouterViewContainer;
    const visibilityOfRouterViewContainer: Function = expectedConditions.visibilityOf(getRouterViewContainer);

    await browser.get(aureliaUrl);
    await browser.driver
      .wait(() => {
        browser.wait(visibilityOfRouterViewContainer, defaultTimeoutMS);

        return getRouterViewContainer;
      });

    await solutionExplorer.openProcessModelByClick(processModelId);

    const bpmnIoTag: ElementFinder = bpmnIo.bpmnIoTag;
    const visibilityOfBpmnIoTag: Function = expectedConditions.visibilityOf(bpmnIoTag);

    // Wait until the diagram is loaded
    await browser.driver
      .wait(() => {
        browser.wait(visibilityOfBpmnIoTag, defaultTimeoutMS);

        return bpmnIoTag;
      });
  });

  it('should contain `Show XML` button in status bar.', async() => {
    const statusBarXMLViewButton: ElementFinder = statusBar.statusBarXMLViewButton;
    const statusBarXMLViewButtonIsDisplayed: boolean = await statusBarXMLViewButton.isDisplayed();

    expect(statusBarXMLViewButtonIsDisplayed).toBeTruthy();
  });

  it('should be possible to open xml view when click on `Show XML` button.', async() => {
    const statusBarXMLViewButton: ElementFinder = statusBar.statusBarXMLViewButton;
    const bpmnXmlViewTag: ElementFinder = bpmnXmlView.bpmnXmlViewTag;

    await BpmnXmlView.openXMLViewByClickOnButton(statusBarXMLViewButton);

    const xmlViewIsDisplayed: boolean = await bpmnXmlViewTag.isDisplayed();

    expect(xmlViewIsDisplayed).toBeTruthy();
  });
});
