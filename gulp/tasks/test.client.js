var karma = require('karma').server;

module.exports = function () {
  return karma.start({
    browsers: ['Chrome'],
    basePath: 'client',
    files: [
      // Dependency
      'bower_components/angular/angular.min.js',
      'bower_components/angular-sanitize/angular-sanitize.min.js',
      'bower_components/angular-resource/angular-resource.min.js',
      'bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js',
      'bower_components/momentjs/min/moment.min.js',
      'bower_components/lodash/dist/lodash.min.js',
      'bower_components/chai/chai.js',
      'bower_components/mocha/mocha.js',
      'bower_components/angular-google-chart/ng-google-chart.js',

      // Mock
      'bower_components/angular-mocks/angular-mocks.js',

      // Src
      'cfd/cfd.sys.config.js',
      'cfd/cfd.config.js',
      'cfd/cfd.service.js',
      'cfd/cfd.chart.js',
      'cfd/cfd.js',

      // Test spec
      'test/spec/*.js'
    ],
    frameworks: ['mocha'],
    singleRun: true
  }, function (exitCode) {
    // gutil.log('Karma has exited with ' + exitCode);
    process.exit(exitCode);
  });

};
