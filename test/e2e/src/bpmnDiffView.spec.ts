import {
  browser,
  ElementFinder,
  protractor,
  ProtractorExpectedConditions,
} from 'protractor';

import {BpmnIo} from './pages/bpmn-io';
import {BpmnDiffView} from './pages/bpmnDiffView';
import {General} from './pages/general';
import {NavBar} from './pages/navBar';
import {ProcessModel} from './pages/processModel';
import {SolutionExplorer} from './pages/solutionExplorer';
import {StatusBar} from './pages/statusBar';

describe('bpmn-io compare view', () => {

  let bpmnDiffView: BpmnDiffView;
  let bpmnIo: BpmnIo;
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
    bpmnDiffView = new BpmnDiffView();
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

    // Wait until diagram is loaded
    await browser.driver
      .wait(() => {
        browser.wait(visibilityOfBpmnIoTag, defaultTimeoutMS);

        return bpmnIo.bpmnIoTag;
      });
  });

  it('should contain `Show Diff` button in status bar.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;
    const statusBarDiffViewButtonIsDisplayed: boolean = await statusBarDiffViewButton.isDisplayed();

    expect(statusBarDiffViewButtonIsDisplayed).toBeTruthy();
  });

  it('should be possible to open xml view when click on `Show Diff` button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const bpmnDiffViewTag: ElementFinder = bpmnDiffView.bpmnDiffViewTag;
    const bpmnDiffViewTagIsDisplayed: boolean = await bpmnDiffViewTag.isDisplayed();

    expect(bpmnDiffViewTagIsDisplayed).toBeTruthy();
  });

  it('should be possible to close xml view when click on `Show Diagram` button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;
    const statusBarDisableDiffViewButton: ElementFinder = statusBar.statusBarDisableDiffViewButton;

    // Open diff view
    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    // And then close the diff view
    await BpmnDiffView.closeDiffViewByClickOnButton(statusBarDisableDiffViewButton);

    const bpmnDiffViewTag: ElementFinder = bpmnDiffView.bpmnDiffViewTag;

    try {
      await bpmnDiffViewTag.isDisplayed();

      // This should never been reached, because bpmnDiffViewTag should not been displayed.
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it('should be possible to click on `Before vs. After` button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const statusBarOldVsNewButton: ElementFinder = statusBar.statusBarOldVsNewButton;
    const statusBarNewVsOldButton: ElementFinder = statusBar.statusBarNewVsOldButton;

    await statusBarOldVsNewButton.click();

    const statusBarOldVsNewButtonIsEnabled: boolean = await statusBar.statusBarButtonIsEnabled(statusBarOldVsNewButton);
    expect(statusBarOldVsNewButtonIsEnabled).toBeTruthy();

    const statusBarNewVsOldButtonIsEnabled: boolean = await statusBar.statusBarButtonIsEnabled(statusBarNewVsOldButton);
    expect(statusBarNewVsOldButtonIsEnabled).not.toBeTruthy();
  });

  it('should be possible to click on `After vs. Before` button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const statusBarOldVsNewButton: ElementFinder = statusBar.statusBarOldVsNewButton;
    const statusBarNewVsOldButton: ElementFinder = statusBar.statusBarNewVsOldButton;

    await statusBarNewVsOldButton.click();

    const statusBarOldVsNewButtonIsEnabled: boolean = await statusBar.statusBarButtonIsEnabled(statusBarOldVsNewButton);
    expect(statusBarOldVsNewButtonIsEnabled).not.toBeTruthy();

    const statusBarNewVsOldButtonIsEnabled: boolean = await statusBar.statusBarButtonIsEnabled(statusBarNewVsOldButton);
    expect(statusBarNewVsOldButtonIsEnabled).toBeTruthy();
  });

  it('should be possible to click on changes log button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const statusBarChangesLogButton: ElementFinder = statusBar.statusBarChangesLogButton;

    await statusBarChangesLogButton.click();

    const statusBarChangesLogButtonIsEnabled: boolean = await statusBar.statusBarButtonIsEnabled(statusBarChangesLogButton);
    expect(statusBarChangesLogButtonIsEnabled).toBeTruthy();
  });

  it('should be possible to open changes log window by clicking on changes log button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const statusBarChangesLogButton: ElementFinder = statusBar.statusBarChangesLogButton;

    await statusBarChangesLogButton.click();

    const changesListElement: ElementFinder = bpmnDiffView.changesListId;
    const changesListElementIsDisplayed: boolean = await changesListElement.isDisplayed();
    expect(changesListElementIsDisplayed).toBeTruthy();
  });

  it('should be possible to close changes log window by clicking on changes log button.', async() => {
    const statusBarDiffViewButton: ElementFinder = statusBar.statusBarDiffViewButton;

    await BpmnDiffView.openDiffViewByClickOnButton(statusBarDiffViewButton);

    const statusBarChangesLogButton: ElementFinder = statusBar.statusBarChangesLogButton;

    await statusBarChangesLogButton.click();

    const changesListElement: ElementFinder = bpmnDiffView.changesListId;
    const changesListElementIsDisplayed: boolean = await changesListElement.isDisplayed();
    expect(changesListElementIsDisplayed).toBeTruthy();

    await statusBarChangesLogButton.click();

    try {
      await changesListElement.isDisplayed();
      expect(false).toBeTruthy();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
