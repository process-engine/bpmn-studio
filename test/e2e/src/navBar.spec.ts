import {
  browser,
  ElementArrayFinder,
  ElementFinder,
  protractor,
  ProtractorExpectedConditions,
} from 'protractor';

import {Dashboard} from './pages/dashboard';
import {NavBar} from './pages/navBar';
import {ProcessModel} from './pages/processModel';

describe('Navigation bar', () => {
  let dashboard: Dashboard;
  let navBar: NavBar;
  let processModel: ProcessModel;

  const aureliaUrl: string = browser.params.aureliaUrl;
  const defaultTimeoutMS: number = browser.params.defaultTimeoutMS;

  const expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;

  beforeAll(() => {
    dashboard = new Dashboard();
    navBar = new NavBar();
    processModel = new ProcessModel();
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
        browser
          .wait(visibilityOfNavBarTag, defaultTimeoutMS);

        return navBarTag;
      });
  });

  it('should display.', async() => {
    const navBarTag: ElementFinder = navBar.navBarTag;
    const navBarTagIsDisplayed: boolean = await navBarTag.isDisplayed();

    expect(navBarTagIsDisplayed).toBeTruthy();
  });

  it('should contain root and 3 elements (left-bar, center-bar, right bar)', async() => {
    const navBarContainer: ElementFinder = navBar.navBarContainer;
    const navBarContainerIsDisplayed: boolean = await navBarContainer.isDisplayed();

    expect(navBarContainerIsDisplayed).toBeTruthy();

    const navBarContainerLeft: ElementFinder = navBar.navBarContainerLeft;
    const navBarContainerLeftIsDisplayed: boolean = await navBarContainerLeft.isDisplayed();

    expect(navBarContainerLeftIsDisplayed).toBeTruthy();

    const navBarContainerCenter: ElementFinder = navBar.navBarContainerCenter;
    const navBarContainerCenterIsDisplayed: boolean = await navBarContainerCenter.isDisplayed();

    expect(navBarContainerCenterIsDisplayed).toBeTruthy();

    const navBarContainerRight: ElementFinder = navBar.navBarContainerRight;
    const navBarContainerRightIsDisplayed: boolean = await navBarContainerRight.isDisplayed();

    expect(navBarContainerRightIsDisplayed).toBeTruthy();
  });

  // This section tests the login button
  it('should contain login button.', async() => {
    const navBarLogInButton: ElementFinder = navBar.navBarLogInButton;
    const navBarLogInButtonIsDisplayed: boolean = await navBarLogInButton.isDisplayed();

    expect(navBarLogInButtonIsDisplayed).toBeTruthy();
  });

  // This section tests the solution explorer button
  it('should contain solution explorer button.', async() => {
    const navBarSolutionExplorerButton: ElementFinder = navBar.navBarSolutionExplorerButton;
    const navBarSolutionExplorerButtonIsDisplayed: boolean = await navBarSolutionExplorerButton.isDisplayed();

    expect(navBarSolutionExplorerButtonIsDisplayed).toBeTruthy();
  });

  it('should contain an enabled solution explorer button.', async() => {
    const navBarSolutionExplorerButton: ElementFinder = navBar.navBarSolutionExplorerButton;
    const navBarSolutionExplorerButtonAttributes: boolean = await navBar.navBarButtonIsDisabled(navBarSolutionExplorerButton);

    expect(navBarSolutionExplorerButtonAttributes).toBeTruthy();
  });

  it('should contain an highlighted solution explorer button.', async() => {
    const navBarActiveSolutionExplorer: ElementArrayFinder = navBar.navBarActiveSolutionExplorer;
    const numberOfActiveSolutionExplorers: number = await navBarActiveSolutionExplorer.count();

    expect(numberOfActiveSolutionExplorers).toBe(1);
  });

  // This section tests the think button
  it('should contain think button.', async() => {
    const navBarThinkLink: ElementFinder = navBar.navBarThinkLink;
    const navBarThinkLinkIsDisplayed: boolean = await navBarThinkLink.isDisplayed();

    expect(navBarThinkLinkIsDisplayed).toBeTruthy();

  });

  it('should contain an enabled think view button.', async() => {
    const navBarThinkLink: ElementFinder = navBar.navBarThinkLink;
    const navBarThinkLinkAttributes: boolean = await navBar.navBarButtonIsDisabled(navBarThinkLink);

    expect(navBarThinkLinkAttributes).toBeTruthy();
  });

  it('should open process list view when think button is clicked.', async() => {
    const navBarThinkLink: ElementFinder = navBar.navBarThinkLink;

    await navBarThinkLink.click();

    const currentBrowserUrl: string = await browser.getCurrentUrl();
    const processModelLink: string = ProcessModel.getProcessModelLink();

    expect(currentBrowserUrl).toContain(processModelLink);
  });

  // This section tests the design button
  it('should contain design button.', async() => {
    const navBarDesignLink: ElementFinder = navBar.navBarDesignLink;
    const navBarDesignLinkIsDisplayed: boolean = await navBarDesignLink.isDisplayed();

    expect(navBarDesignLinkIsDisplayed).toBeTruthy();
  });

  it('should contain an enabled design view button.', async() => {
    const navBarDesignLink: ElementFinder = navBar.navBarDesignLink;
    const navBarDesignLinkAttributes: boolean = await navBar.navBarButtonIsDisabled(navBarDesignLink);

    expect(navBarDesignLinkAttributes).toBeTruthy();
  });

  // This section tests the inspect button
  it('should contain inspect button.', async() => {
    const navBarInspectLink: ElementFinder = navBar.navBarInspectLink;
    const navBarInspectLinkIsDisplayed: boolean = await navBarInspectLink.isDisplayed();

    expect(navBarInspectLinkIsDisplayed).toBeTruthy();
  });

  it('should contain an enabled inspect view button.', async() => {
    const navBarInspectLink: ElementFinder = navBar.navBarInspectLink;
    const navBarInspectLinkAttributes: boolean = await navBar.navBarButtonIsDisabled(navBarInspectLink);

    expect(navBarInspectLinkAttributes).toBeTruthy();
  });

  it('should open inspect view when the inspect button is clicked.', async() => {
    const navBarInspectLink: ElementFinder = navBar.navBarInspectLink;

    await navBarInspectLink.click();

    const processListTag: ElementFinder = dashboard.processListTag;
    const visibilityOfProcessListTag: Function = expectedConditions.visibilityOf(processListTag);

    await browser.driver
      .wait(() => {
        browser
          .wait(visibilityOfProcessListTag, defaultTimeoutMS);

        return processListTag;
      });

    const currentBrowserUrl: string = await browser.getCurrentUrl();
    const dashboardLink: string = dashboard.dashboardLink;

    expect(currentBrowserUrl).toContain(dashboardLink);
  });

});
