const MINUTE_IN_MS = 1000 * 60
const MAX_TIMEOUT = 2 * MINUTE_IN_MS

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: [ 'browserify', 'jasmine' ],
    browserify: {
      debug: true,
      transform: [],
      plugin: []
    },
    files: [
      'test/**.js'
    ],
    preprocessors: {
      'test/**.js': [ 'browserify' ]
    },
    reporters: [ 'progress' ],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: [ 'ChromeHeadless' ],
    concurrency: 1,
    captureTimeout: MAX_TIMEOUT,
    browserDisconnectTimeout: MAX_TIMEOUT,
    browserNoActivityTimeout: MAX_TIMEOUT,
    singleRun: false
  })
}
