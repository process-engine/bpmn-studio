import * as path from 'path';
import {browser, by, element, ElementFinder, protractor, ProtractorExpectedConditions} from 'protractor';

fdescribe('nav-bar', () => {
  const aureliaUrl: string = browser.params.aureliaUrl;
  const defaultTimeoutMS: number = browser.params.defaultTimeoutMS;

  const expectedConditions: ProtractorExpectedConditions = protractor.ExpectedConditions;
  const navBar: ElementFinder = element(by.tagName('nav-bar'));

  browser.driver.manage().deleteAllCookies();

  beforeEach(() => {
    browser.get(aureliaUrl);
    browser.driver.wait(() => {
      browser.wait(expectedConditions.visibilityOf(navBar), defaultTimeoutMS);
      return navBar;
    });
  });

  it('should display', () => {
    navBar.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });
  });

  it('should contain root and 3 elements (left-bar, center-bar, right bar)', () => {
    expect(navBar.element(by.className('bpmn-studio-navbar')).element.length).toBe(1);
    expect(navBar.element(by.className('menu-bar__menu--left')).element.length).toBe(1);
    expect(navBar.element(by.className('menu-bar__menu--center')).element.length).toBe(1);
    expect(navBar.element(by.className('menu-bar__menu--right')).element.length).toBe(1);
  });

  it('should contain login button', () => {
    const loginButton: ElementFinder = navBar.element(by.id('userLoginButton'));
    loginButton.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });
  });

  it('should contain solution explorer button', () => {
    const navbarSolutionExplorerButton: ElementFinder = navBar.element(by.id('navbarSolutionExplorerButton'));

    // check if button is available
    navbarSolutionExplorerButton.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });

    // check if solution explorer button is enabled
    navbarSolutionExplorerButton.getAttribute('class').then((attribute: Object) => {
      expect(attribute).not.toContain('menu-tabbed-link--disabled');
    });

    // check if solution explorer button is highlighted when clicked
    navbarSolutionExplorerButton.click().then(() => {
      expect(navBar.element(by.className('solution-explorer--active')).element.length).toBe(1);
    });
  });

  it('should contain plan button', () => {
    const navbarPlanLink: ElementFinder = navBar.element(by.id('navbarPlanLink'));

    // check if button is available
    navbarPlanLink.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });

    // check if plan view is enabled
    navbarPlanLink.getAttribute('class').then((attribute: Object) => {
      expect(attribute).not.toContain('menu-tabbed-link--disabled');
    });

    // check if plan view opens
    navbarPlanLink.click().then(() => {
      browser.getCurrentUrl().then((url: string) => {
        expect(url).toMatch('processdef');
      });
    });
  });

  it('should contain design button', () => {
    const navbarDesignLink: ElementFinder = navBar.element(by.id('navbarDesignLink'));

    // check if button is available
    navbarDesignLink.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });

    // check if design view is disabled
    navbarDesignLink.getAttribute('class').then((attribute: Object) => {
      expect(attribute).toContain('menu-tabbed-link--disabled');
    });
  });

  it('should contain publish button', () => {
    const navbarPublishLink: ElementFinder = navBar.element(by.id('navbarPublishLink'));

    // check if button is available
    navbarPublishLink.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });

    // check if design view is disabled
    navbarPublishLink.getAttribute('class').then((attribute: Object) => {
      expect(attribute).toContain('menu-tabbed-link--disabled');
    });
  });

  it('should contain dashboard button', () => {
    const navbarDashboardLink: ElementFinder = navBar.element(by.id('navbarDashboardLink'));

    // check if button is available
    navbarDashboardLink.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });

    // check if design view is enabled
    navbarDashboardLink.getAttribute('class').then((attribute: Object) => {
      expect(attribute).not.toContain('menu-tabbed-link--disabled');
    });

    // check if dashboard view opens
    navbarDashboardLink.click().then(() => {
      browser.getCurrentUrl().then((url: string) => {
        expect(url).toMatch('dashboard');
      });
    });
  });

  afterEach(() => {
    browser.executeScript('window.localStorage.clear();');
    browser.executeScript('window.sessionStorage.clear();');
    browser.driver.manage().deleteAllCookies();
  });
});
