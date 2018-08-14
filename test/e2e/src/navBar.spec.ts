import * as path from 'path';
import {browser, by, element, ElementArrayFinder, ElementFinder, protractor, ProtractorExpectedConditions} from 'protractor';

describe('nav-bar', () => {
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
    const loginButton: ElementFinder = navBar.element(by.tagName('user-login'))
                                             .element(by.className('user-login'))
                                             .element(by.buttonText('login'));
    loginButton.isDisplayed().then((result: boolean) => {
      expect(result).toBeTruthy();
    });
  });

  it('should contain solution explorer button', () => {
    const navBarButtons: ElementArrayFinder = navBar.all(by.className('menu__menu-tabbed-link'));

    // check if at least 1 button is available (solution-explorer)
    navBarButtons.count().then((result: number) => {
      expect(result).toBeGreaterThanOrEqual(1);
    });

    // check if solution explorer button is highlighted
    navBarButtons.all(by.tagName('button')).get(0).click().then(() => {
      expect(navBar.element(by.className('solution-explorer--active')).element.length).toBe(1);
    });
  });

    // @TODO Add IDs in frontend !!!
  it('should contain plan button', () => {
    const navBarButtons: ElementArrayFinder = navBar.all(by.className('menu__menu-tabbed-link'));

    // check if at least 2 buttons are available (solution-explorer, plan)
    navBarButtons.count().then((result: number) => {
      expect(result).toBeGreaterThanOrEqual(2);
    });

    // check if plan view opens
    navBarButtons.all(by.tagName('a')).get(0).click().then(() => {
      browser.getCurrentUrl().then((url: string) => {
        expect(url).toMatch('processdef');
      });
    });
  });

  it('should contain design button', () => {
    const navBarButtons: ElementArrayFinder = navBar.all(by.className('menu__menu-tabbed-link'));

    // check if at least 3 buttons are available (solution-explorer, plan, design)
    navBarButtons.count().then((result: number) => {
      expect(result).toBeGreaterThanOrEqual(3);
    });

    // check if design view is disabled
    expect(navBarButtons.all(by.tagName('a')).get(1).element(by.className('menu-tabbed-link--disabled')).element.length).toBe(1);
  });

  it('should contain publish button', () => {
    const navBarButtons: ElementArrayFinder = navBar.all(by.className('menu__menu-tabbed-link'));

    // check if at least 3 buttons are available (solution-explorer, plan, design, publish)
    navBarButtons.count().then((result: number) => {
      expect(result).toBeGreaterThanOrEqual(4);
    });

    // check if publish view is disabled
    expect(navBarButtons.all(by.tagName('a')).get(2).element(by.className('menu-tabbed-link--disabled')).element.length).toBe(1);
  });

  it('should contain dashboard button', () => {
    const navBarButtons: ElementArrayFinder = navBar.all(by.className('menu__menu-tabbed-link'));

    // check if at least 3 buttons are available (solution-explorer, plan, design, publish, dashboard)
    navBarButtons.count().then((result: number) => {
      expect(result).toBeGreaterThanOrEqual(5);
    });

    // check if design view is disabled
    expect(navBarButtons.all(by.tagName('a')).get(3).element(by.className('menu-tabbed-link--disabled')).element.length).toBe(1);
  });

  afterEach(() => {
    browser.executeScript('window.localStorage.clear();');
    browser.executeScript('window.sessionStorage.clear();');
    browser.driver.manage().deleteAllCookies();
  });
});
