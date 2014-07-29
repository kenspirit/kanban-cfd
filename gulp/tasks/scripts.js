var gulp = require('gulp'),
    rename = require("gulp-rename"),
    browserify = require('gulp-browserify');

module.exports = function() {
    // Single entry point to browserify
    gulp.src('server/config.js')
      .pipe(rename(function(path) {
        path.basename = 'cfd.sys.' + path.basename;
      }))
      .pipe(browserify({
        insertGlobals : false,
        standalone: 'CFD'
      }))
      .pipe(gulp.dest('client/cfd/'));
};
