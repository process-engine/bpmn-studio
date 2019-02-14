exports.config = {
  directConnect: false,

  multiCapabilities: [
    {
      browserName: 'chrome',
      chromeOptions: {
        args: [
          "--headless",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--window-size=1920,1080",
        ],
      },
    },
  ],

  /**
   * Maximum number of total browser sessions to run. Tests are queued in
   * sequence if number of browser sessions is limited by this parameter.
   * Use a number less than 1 to denote unlimited. Default is unlimited.
   */
  maxSessions: 1,

  seleniumAddress: 'http://0.0.0.0:4444/wd/hub',
  specs: ['test/e2e/dist/*.js'],

  plugins: [{
    package: 'aurelia-protractor-plugin',
  }],

  params: {
    aureliaUrl: string = 'http://localhost:9000',
    processEngineUrl: string = 'http://localhost:8000',
    defaultTimeoutMS: number = 10000,
  },

  framework: 'jasmine',

  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
  },

  onPrepare: function () {
    browser.manage().window().maximize();

    afterEach(() => {
      browser.executeScript('window.localStorage.clear();');
      browser.executeScript('window.sessionStorage.clear();');
      browser.driver.manage().deleteAllCookies();
    });
  }
};
