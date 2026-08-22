import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDocument } from '../tools/verify.mjs';

const GOOD = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team | Bloomington Velo</title>
<meta name="description" content="Meet the riders of Bloomington Velo, a cycling club in Bloomington, Indiana.">
<link rel="canonical" href="https://bloomingtonvelo.org/team/">
<meta property="og:title" content="Team | Bloomington Velo">
<meta property="og:image" content="https://bloomingtonvelo.org/assets/img/og-default.jpg">
</head><body><main><h1>Team</h1></main></body></html>`;

test('a well-formed document reports no errors', () => {
  assert.deepEqual(checkDocument(GOOD, { path: 'team/index.html' }).errors, []);
});

test('missing doctype is an error', () => {
  const { errors } = checkDocument(GOOD.replace('<!doctype html>\n', ''), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('doctype')));
});

test('missing lang attribute is an error', () => {
  const { errors } = checkDocument(GOOD.replace('<html lang="en">', '<html>'), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('lang')));
});

test('missing meta description is an error', () => {
  const { errors } = checkDocument(GOOD.replace(/<meta name="description"[^>]*>/, ''), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('description')));
});

test('missing canonical is an error', () => {
  const { errors } = checkDocument(GOOD.replace(/<link rel="canonical"[^>]*>/, ''), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('canonical')));
});

test('zero h1 is an error', () => {
  const { errors } = checkDocument(GOOD.replace('<h1>Team</h1>', ''), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('h1')));
});

test('two h1 elements is an error', () => {
  const { errors } = checkDocument(GOOD.replace('<h1>Team</h1>', '<h1>A</h1><h1>B</h1>'), { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('h1')));
});

test('an iframe without loading=lazy is an error', () => {
  const bad = GOOD.replace('</main>', '<iframe src="https://calendar.google.com/x" title="Calendar"></iframe></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('loading="lazy"')));
});

test('an iframe without a title is an error', () => {
  const bad = GOOD.replace('</main>', '<iframe src="https://calendar.google.com/x" loading="lazy"></iframe></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('iframe') && e.includes('title')));
});

test('an img without alt is an error', () => {
  const bad = GOOD.replace('</main>', '<img src="a.jpg" width="1" height="1"></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('alt')));
});

test('an external link without rel=noopener is an error', () => {
  const bad = GOOD.replace('</main>', '<a href="https://www.strava.com/clubs/329602" target="_blank">Strava</a></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('noopener')));
});
