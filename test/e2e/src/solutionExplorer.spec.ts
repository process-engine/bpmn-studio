import {
  browser,
  ElementArrayFinder,
  ElementFinder,
  protractor,
  ProtractorExpectedConditions,
} from 'protractor';

import {NavBar} from './pages/navBar';
import {ProcessModel} from './pages/processModel';
import {SolutionExplorer} from './pages/solutionExplorer';

describe('Solution Explorer', () => {

  let navBar: NavBar;
  let processModel: ProcessModel;
  let solutionExplorer: SolutionExplorer;

  let processModelId: string;

  const aureliaUrl: string = browser.params.aureliaUrl;
  const defaultTimeoutMS: number = browser.params.defaultTimeoutMS;

  const expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  beforeAll(() => {

    navBar = new NavBar();
    processModel = new ProcessModel();
    solutionExplorer = new SolutionExplorer();

    processModelId = processModel.getProcessModelId();

    // Create a new process definition by POST REST call
    processModel.postProcessModel(processModelId);
  });

  afterAll(async() => {

    await processModel.deleteProcessModel();
  });

  beforeEach(async() => {
    const navBarTag: ElementFinder = navBar.navBarTag;
    const visibilityOfNavBarTag: Function = expectedConditions.visibilityOf(navBarTag);

    await browser.get(aureliaUrl);
    await browser.driver
      .wait(() => {
        browser.wait(visibilityOfNavBarTag, defaultTimeoutMS);

        return navBarTag;
      });

    // Wait until solutions are loaded
    await browser.driver.wait(() => {
      browser.wait(expectedConditions.visibilityOf(solutionExplorer.solutionExplorerListItemsId(processModelId)), defaultTimeoutMS);

      return solutionExplorer.solutionExplorerListItemsId(processModelId);
    });
  });

  it('should display more than one process definitions.', async() => {
    const solutionExplorerListItems: ElementArrayFinder = solutionExplorer.solutionExplorerListItems;
    const numberOfProcessDefinitions: number = await solutionExplorerListItems.count();

    expect(numberOfProcessDefinitions).toBeGreaterThan(0);
  });

  it('should display created solution.', async() => {
    const solutionExplorerListItemsIds: ElementArrayFinder = solutionExplorer.solutionExplorerListItemsIds(processModelId);
    const numberOfProcessDefinitionsById: number = await solutionExplorerListItemsIds.count();

    expect(numberOfProcessDefinitionsById).toBe(1);
  });

  it('should be possible to open a process diagram.', async() => {
    const getProcessModelLink: string = ProcessModel.getProcessModelUrl();

    await solutionExplorer.openProcessModelByClick(processModelId);

    const currentBrowserUrl: string = await browser.getCurrentUrl();

    expect(currentBrowserUrl).toContain(getProcessModelLink);
  });

});
