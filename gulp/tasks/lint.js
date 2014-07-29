var jshint = require('gulp-jshint');
var gulp   = require('gulp');

module.exports = function() {
  return gulp.src([
      'client/cfd/*.js',
      '!client/cfd/cfd.sys.config.js',
      'client/test/spec/*.js',
      'server/**/*.js',
      '*.js'
    ])
    .pipe(jshint({
      curly: true,
      newcap: true,
      noempty: true,
      quotmark: true,
      undef: true,
      unused: true,
      trailing: true,
      node: true,
      browser: true,
      predef: ['angular', 'describe', 'it', 'before', 'chai', 'beforeEach', 'inject', 'CFD']
    }))
    .pipe(jshint.reporter('default'));
};
