var gulp = require('./gulp')([
  'lint',
  'scripts',
  'test.server',
  'test.client'
]);

gulp.task('test', ['test.client', 'test.server']);
gulp.task('default', ['lint', 'test', 'scripts']);
