exports.config = {
  seleniumAddress: `http://${process.env.CB_USER}:${process.env.CB_KEY}@hub.crossbrowsertesting.com:80/wd/hub`,
  sessionId: null,

  multiCapabilities: [
    {
      name: '(Chrome69x64/W10) BPMN Studio E2E Test',
      build: '4.4.0',
      browserName: 'Chrome',
      version: '69x64',
      platform: 'Windows 10',
      screenResolution: '1920x1080',
      record_video: true,
      record_network: true,
      record_snapshot: true,
      chromeOptions: {
        args: ['--window-size=1920,1080'],
      },
    },
    {
      name: '(Safari11/Mac10.13) BPMN Studio E2E Test',
      build: '4.4.0',
      browserName: 'Safari',
      version: '11',
      platform: 'Mac OSX 10.13',
      screenResolution: '1920x1200',
      record_video: true,
      record_network: true,
      record_snapshot: true,
    },
  ],

  maxSessions: 1,

  params: {
    aureliaUrl: process.env.aureliaUrl,
    processEngineUrl: process.env.processEngineUrl,
    defaultTimeoutMS: (number = 30000),
  },

  specs: ['test/e2e/dist/*.js'],

  plugins: [
    {
      package: 'aurelia-protractor-plugin',
    },
  ],

  framework: 'jasmine',

  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
  },

  onPrepare: function () {
    browser
      .manage()
      .window()
      .maximize();

    beforeAll(() => {
      browser.driver.getSession().then(function (session) {
        this.sessionId = session.id; // need for API calls
        console.log(`Session ID:  ${sessionId}`);
        console.log(`See your test run at: https://app.crossbrowsertesting.com/selenium/${sessionId}`);
      });
    });
    afterEach(() => {
      browser.executeScript('window.localStorage.clear();');
      browser.executeScript('window.sessionStorage.clear();');
      browser.driver.manage().deleteAllCookies();
    });
  },
};
