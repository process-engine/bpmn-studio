import {
  browser,
  ElementFinder,
  protractor,
  ProtractorExpectedConditions,
} from 'protractor';

import {BpmnIo} from './pages/bpmn-io';
import {General} from './pages/general';
import {Minimap} from './pages/minimap';
import {NavBar} from './pages/navBar';
import {ProcessModel} from './pages/processModel';
import {SolutionExplorer} from './pages/solutionExplorer';
import {StatusBar} from './pages/statusBar';

describe('Minimap view', () => {

  let bpmnIo: BpmnIo;
  let minimap: Minimap;
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
    minimap = new Minimap();
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

  it('should contain `Open` button in drawer.', async() => {
    const openButton: ElementFinder = minimap.openButton;
    const openButtonIsDisplayed: boolean = await openButton.isDisplayed();

    expect(openButtonIsDisplayed).toBeTruthy();
  });

  it('should not contain `open` class attribute by default.', async() => {
    const openButtonIncludesAttribute: boolean = await minimap.openButtonIncludesOpenAttribute();

    expect(openButtonIncludesAttribute).not.toBeTruthy();
  });

  it('should contain `open` class attribute when clicked.', async() => {
    await minimap.clickOpenButton();
    const openButtonIncludesAttribute: boolean = await minimap.openButtonIncludesOpenAttribute();

    expect(openButtonIncludesAttribute).toBeTruthy();
  });

  it('should be possible to close minimap.', async() => {

    // Open minimap
    await minimap.clickOpenButton();

    // Close minimap
    await minimap.clickToggleButton();

    const openButtonIncludesAttribute: boolean = await minimap.openButtonIncludesOpenAttribute();

    expect(openButtonIncludesAttribute).not.toBeTruthy();
  });
});
