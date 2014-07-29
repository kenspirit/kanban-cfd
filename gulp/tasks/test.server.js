var gulp = require('gulp'),
    mocha = require('gulp-mocha');

module.exports = function () {
  gulp.src([
      'server/test/spec/*.js'
    ])
    .pipe(mocha({reporter: 'nyan', timeout: 1000}));
};
