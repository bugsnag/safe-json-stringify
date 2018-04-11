const browsers = require('./browsers.json')
const MINUTE_IN_MS = 1000 * 60
const MAX_TIMEOUT = 2 * MINUTE_IN_MS
const CI_BS_CONF = {
  video: false,
  startTunnel: false,
  tunnelIdentifier: process.env.BROWSERSTACK_LOCAL_IDENTIFIER,
  project: process.env.TRAVIS_REPO_SLUG + '#' + process.env.TRAVIS_BRANCH
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: [ 'browserify', 'jasmine' ],
    browserify: {
      debug: true,
      transform: [],
      plugin: []
    },
    browserStack: process.env.TRAVIS ? CI_BS_CONF : { startTunnel: true, video: false },
    files: [
      'test/**.js'
    ],
    preprocessors: {
      'test/**.js': [ 'browserify' ]
    },
    reporters: [ 'progress', 'BrowserStack' ],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    customLaunchers: browsers,
    browsers: [ 'ChromeHeadless' ].concat(Object.keys(browsers)),
    concurrency: 1,
    captureTimeout: MAX_TIMEOUT,
    browserDisconnectTimeout: MAX_TIMEOUT,
    browserNoActivityTimeout: MAX_TIMEOUT,
    singleRun: false
  })
}
