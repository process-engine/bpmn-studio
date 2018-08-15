exports.config = {
  directConnect: false,

  multiCapabilities: [
    {
      browserName: 'chrome',
    },
  ],

  maxSessions: 1,

  seleniumAddress: 'http://0.0.0.0:4444/wd/hub',
  specs: ['test/e2e/dist/*.js'],

  plugins: [{
    package: 'aurelia-protractor-plugin',
  }],

  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000
  }
};
