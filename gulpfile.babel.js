import browserify from 'browserify';
import babelify from 'babelify';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import R from 'ramda';
import cp from 'child_process';
import del from 'del';
import ghPages from 'gh-pages';
import path from 'path';
import escapeRegExp from 'lodash.escaperegexp';

import gulp from 'gulp';
import sass from 'gulp-sass';
import csso from 'gulp-csso';
import gutil from 'gulp-util';
import uglify from 'gulp-uglify';
import sourcemaps from 'gulp-sourcemaps';
import autoprefixer from 'gulp-autoprefixer';
import revAll from 'gulp-rev-all';
import replace from 'gulp-replace';
import file from 'gulp-file';

/////////////////////////////////////////////////////////////

const redirects = [
  { from: '/code', to: '/sections/page/code' },
  { from: '/presentations', to: '/sections/page/presentations' },
];

const netlifyRedirects = redirects.map(({ from, to }) => `${from} ${to} 200`)
  .join('\n');

const CNAME = 'alex.katopod.is';

const SECTIONS_STATIC_SOURCE_BASE = './sections/themes/beautifulhugo/static-src';
const SECTIONS_STATIC_SOURCE_BASE_JS = `${SECTIONS_STATIC_SOURCE_BASE}/js`;
const SECTIONS_STATIC_SOURCE_BASE_SASS = `${SECTIONS_STATIC_SOURCE_BASE}/sass`;
const SECTIONS_STATIC_BASE = './sections/themes/beautifulhugo/static';
const SECTIONS_STATIC_BASE_JS = `${SECTIONS_STATIC_BASE}/js`;
const SECTIONS_STATIC_BASE_CSS = `${SECTIONS_STATIC_BASE}/css`;
const SECTIONS_BUNDLE_PARAMS = [SECTIONS_STATIC_SOURCE_BASE_JS, SECTIONS_STATIC_BASE_JS];
const SECTIONS_SASS_PARAMS = [SECTIONS_STATIC_SOURCE_BASE_SASS, SECTIONS_STATIC_BASE_CSS];
const SECTIONS_BASE_URL = `https://${CNAME}/sections/`;

const LANDING_STATIC_SOURCE_BASE = './landing/themes/hugo-identity-theme/static-src';
const LANDING_STATIC_SOURCE_BASE_SASS = `${LANDING_STATIC_SOURCE_BASE}/assets/sass`;
const LANDING_STATIC_BASE = './landing/themes/hugo-identity-theme/static';
const LANDING_STATIC_BASE_CSS = `${LANDING_STATIC_BASE}/assets/css`;
const LANDING_SASS_PARAMS = [LANDING_STATIC_SOURCE_BASE_SASS, LANDING_STATIC_BASE_CSS];
const LANDING_BASE_URL = `https://${CNAME}/`;

/////////////////////////////////////////////////////////////

gulp.task('sections:compile-js', R.partial(compileJs, SECTIONS_BUNDLE_PARAMS));

gulp.task('sections:compile-sass', R.partial(compileSass, SECTIONS_SASS_PARAMS));

gulp.task('sections:watch', gulp.series(
  gulp.parallel('sections:compile-js', 'sections:compile-sass'),
  R.partial(watch, [
    { glob: `${SECTIONS_STATIC_SOURCE_BASE_JS}/**/*.js`,
      tasks: gulp.series('sections:compile-js') },
    { glob: `${SECTIONS_STATIC_SOURCE_BASE_SASS}/**/*.scss`,
      tasks: gulp.series('sections:compile-sass') },
  ])
));

gulp.task('sections:build', gulp.series(
  gulp.parallel('sections:compile-js', 'sections:compile-sass'),
  R.partial(build, [
    'sections',
    `${process.cwd()}/.tmp-build-sections`,
  ]),
  R.partial(removeBaseUrl, ['./.tmp-build-sections', SECTIONS_BASE_URL]),
  R.partial(rev, ['./.tmp-build-sections', SECTIONS_BASE_URL, './public/sections']),
  () => del('./.tmp-build-sections/*', { dot: true })
));

gulp.task('sections:serve-dev', () => spawn('hugo', [
  'server',
  '-s', 'sections',
  '--port', '1314',
], { stdio: ['pipe', 'inherit', 'pipe'] }));

gulp.task('landing:compile-sass', R.partial(compileSass, LANDING_SASS_PARAMS));

gulp.task('landing:watch', gulp.series('landing:compile-sass', R.partial(watch, [
  { glob: `${LANDING_STATIC_SOURCE_BASE_SASS}/**/*.scss`,
    tasks: gulp.series('landing:compile-sass') },
])));

gulp.task('landing:build', gulp.series(
  'landing:compile-sass',
  R.partial(build, [
    'landing',
    `${process.cwd()}/.tmp-build-landing`,
  ]),
  R.partial(removeBaseUrl, ['./.tmp-build-landing', LANDING_BASE_URL]),
  R.partial(rev, ['./.tmp-build-landing', LANDING_BASE_URL, './public']),
  () => del('./.tmp-build-landing/*', { dot: true })
));

gulp.task('landing:serve-dev', () => spawn('hugo', [
  'server',
  '-s', 'landing',
  '--port', '1313',
], { stdio: ['pipe', 'inherit', 'pipe'] }));

gulp.task('build', gulp.series(
  () => del('./public/*', { dot: true }),
  gulp.parallel('landing:build', 'sections:build'),
  () => file('_redirects', netlifyRedirects, { src: true })
    .pipe(gulp.dest('./public'))
));

gulp.task('deploy', gulp.series(
  'build',
  deploy
));

/////////////////////////////////////////////////////////////

function removeBaseUrl(basePath, baseUrl) {
  const stream = gulp.src(`${basePath}/**/*.html`, { base: basePath })
    .pipe(replace(new RegExp(`(${escapeRegExp(baseUrl)})([^.\\n]+\\.)`, 'g'), '/$2'));

  redirects.forEach(({ from, to }) => {
    stream.pipe(replace(to, from));
  });

  return stream.pipe(gulp.dest(basePath));
}

function build(page, dest) {
  return spawn('hugo', [
    '--config', `${page}/config.toml`,
    '-s', page,
    '-d', dest,
  ]);
}

function compileJs(staticSourceBase, staticBase) {
  // set up the browserify instance on a task basis
  const b = browserify({
    entries: `${staticSourceBase}/entry.js`,
    debug: true,
    // defining transforms here will avoid crashing your stream
    transform: [
      babelify.configure({
        presets: ['es2015'],
      }),
    ],
  });

  return b.bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    // Add transformation tasks to the pipeline here.
    .pipe(uglify())
    .on('error', gutil.log)
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`${staticBase}`));
}

function compileSass(staticSourceBase, staticBase) {
  return gulp.src([
      `${staticSourceBase}/*.scss`,
      `!${staticSourceBase}/_*.scss`,
    ])
    .pipe(sourcemaps.init())
    .pipe(sass({
      includePaths: [
        './node_modules/font-awesome/scss',
        './node_modules/bootstrap-sass/assets/stylesheets',
      ],
    }).on('error', sass.logError))
    .pipe(csso())
    .pipe(autoprefixer({ browsers: ['last 2 versions'] }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`${staticBase}`));
}

function watch(...watches) {
  watches.forEach((w) => {
    gulp.watch(w.glob, w.tasks);
  });
}

function deploy(done) {
  ghPages.publish(path.join(__dirname, 'public'), {
    logger: gutil.log,
    src: ['**/*'],
    repo: 'git@github.com-akatopo:akatopo/alex.git',
    branch: 'gh-pages',
  }, done);
}

function rev(buildPath, baseUrl, dest) {
  return gulp.src([`${buildPath}/**/*`])
    .pipe(revAll.revision({
      dontRenameFile: [/\.html$/, /^\/robots\.txt$/],
      prefix: baseUrl,
    }))
    .pipe(gulp.dest(dest));
}

function spawn(exe, args, { cwd, stdio } = {}) {
  const child = cp.spawn(exe, args, {
    cwd: cwd || process.cwd(),
    stdio: stdio || 'pipe',
  });
  const buf = [];
  return new Promise((resolve, reject) => {
    if (R.path(['stderr', 'on'], child)) {
      child.stderr.on('data', (chunk) => {
        buf.push(chunk.toString());
      });
    }
    if (R.path(['stdout', 'on'], child)) {
      child.stdout.on('data', (chunk) => {
        buf.push(chunk.toString());
      });
    }
    child.on('close', (code) => {
      if (code) {
        const msg = buf.join('') || `Process failed: ${code}`;
        reject(new Error(msg));
      }
      else {
        resolve(code);
      }
    });
  });
}
