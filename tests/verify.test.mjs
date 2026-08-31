import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDocument, checkInternalLinks, expectedCanonical } from '../tools/verify.mjs';

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

// Verbatim team bios (roster-card__bio) can carry <img> tags with no
// width/height that must never be edited to add them — see
// tools/generate-roster-html.mjs and team/index.html. checkDocument exempts
// only images inside a balanced roster-card__bio block from that one rule.
// These four tests pin both the exemption and its boundary: too narrow and
// a legitimate verbatim image fails the build; too wide (a naive
// `[\s\S]*?</div>` stopping at the first nested </div>, the exact class of
// bug that once silently truncated a member's bio) and the check stops
// gating real, fixable pages.

test('a dimensionless img inside a roster-card__bio block is exempt from width/height', () => {
  const bad = GOOD.replace('</main>',
    '<div class="roster-card__bio"><img src="a.svg" alt=""></div></main>');
  const { errors } = checkDocument(bad, { path: 'team/index.html' });
  assert.ok(
    !errors.some((e) => e.includes('width/height')),
    `expected no width/height error for a bio image, got: ${JSON.stringify(errors)}`,
  );
});

test('a dimensionless img outside any bio block is still rejected', () => {
  const bad = GOOD.replace('</main>', '<img src="a.svg" alt=""></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(
    errors.some((e) => e.includes('width/height')),
    `expected a width/height error outside a bio block, got: ${JSON.stringify(errors)}`,
  );
});

test('alt is still required on an img inside a roster-card__bio block', () => {
  const bad = GOOD.replace('</main>',
    '<div class="roster-card__bio"><img src="a.svg"></div></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(
    errors.some((e) => e.includes('alt')),
    `the width/height exemption must not also exempt alt, got: ${JSON.stringify(errors)}`,
  );
  assert.ok(
    !errors.some((e) => e.includes('width/height')),
    `width/height should still be exempt for this same image, got: ${JSON.stringify(errors)}`,
  );
});

test('the bio exemption covers exactly the balanced bio block, not everything after it', () => {
  // Nested <div>s inside the bio (as in a real multi-paragraph bio) must not
  // fool the range-finder into closing early or staying open too long.
  const bad = GOOD.replace('</main>',
    '<div class="roster-card__bio"><div><div>nested</div></div>' +
    '<img src="inside-after-nesting.svg" alt=""></div>' +
    '<img src="outside-the-bio.svg" alt=""></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  const flagged = errors.filter((e) => e.includes('width/height'));
  assert.ok(
    !flagged.some((e) => e.includes('inside-after-nesting.svg')),
    `an image after the nested divs close but still inside the bio must be exempt, got: ${JSON.stringify(errors)}`,
  );
  assert.ok(
    flagged.some((e) => e.includes('outside-the-bio.svg')),
    `an image after the bio block actually ends must still be rejected, got: ${JSON.stringify(errors)}`,
  );
});

// The exemption above must fail CLOSED, not open: an unbalanced bio block
// (unclosed <div>, or a <div>-shaped comment/attribute throwing the depth
// counter off by one) must never fall back to "exempt everything to the end
// of the document." It must be reported as its own defect, and it must not
// swallow the width/height check for images that come after it.

test('an unclosed div inside a roster-card__bio block fails closed and is reported', () => {
  const bad = GOOD.replace('</main>',
    '<div class="roster-card__bio"><div>never closed</div>' +
    '<img src="after-unbalanced-bio.svg" alt=""></main>');
  const { errors } = checkDocument(bad, { path: 'team/index.html' });
  assert.ok(
    errors.some((e) => e.includes('unbalanced') && e.includes('roster-card__bio')),
    `expected an unbalanced-bio error, got: ${JSON.stringify(errors)}`,
  );
  assert.ok(
    errors.some((e) => e.includes('width/height') && e.includes('after-unbalanced-bio.svg')),
    `an image after an unclosed bio must still be rejected, not silently exempted, got: ${JSON.stringify(errors)}`,
  );
});

test('a <div>-shaped comment inside a roster-card__bio block fails closed and is reported', () => {
  const bad = GOOD.replace('</main>',
    '<div class="roster-card__bio"><!-- looks like <div> but is a comment -->real bio text</div>' +
    '<img src="after-comment-bio.svg" alt=""></main>');
  const { errors } = checkDocument(bad, { path: 'team/index.html' });
  assert.ok(
    errors.some((e) => e.includes('unbalanced') && e.includes('roster-card__bio')),
    `expected an unbalanced-bio error from the comment desyncing the depth counter, got: ${JSON.stringify(errors)}`,
  );
  assert.ok(
    errors.some((e) => e.includes('width/height') && e.includes('after-comment-bio.svg')),
    `an image after a comment-desynced bio must still be rejected, not silently exempted, got: ${JSON.stringify(errors)}`,
  );
});

test('an external link without rel=noopener is an error', () => {
  const bad = GOOD.replace('</main>', '<a href="https://www.strava.com/clubs/329602" target="_blank">Strava</a></main>');
  const { errors } = checkDocument(bad, { path: 'x.html' });
  assert.ok(errors.some((e) => e.includes('noopener')));
});

test('a canonical pointing at a different path is an error', () => {
  const bad = GOOD.replace(
    'https://bloomingtonvelo.org/team/',
    'https://bloomingtonvelo.org/contact/',
  );
  const { errors } = checkDocument(bad, { path: 'team/index.html' });
  assert.ok(errors.some((e) => e.includes('canonical')));
});

test('expectedCanonical maps file paths to site URLs', () => {
  assert.equal(expectedCanonical('index.html'), '/');
  assert.equal(expectedCanonical('team/index.html'), '/team/');
  assert.equal(expectedCanonical('team/ride-library/index.html'), '/team/ride-library/');
  assert.equal(expectedCanonical('404.html'), '/404.html');
});

test('an internal link without a trailing slash is an error', () => {
  const errors = checkInternalLinks('<a href="/team">Team</a>', { path: 'x.html', rootDir: '.' });
  assert.ok(errors.some((e) => e.includes('trailing slash')));
});

test('a root-relative link to a long-extension file is not treated as a directory', () => {
  // .webmanifest is 11 characters. An extension test capped at 5 misreads the
  // path as a directory and demands a trailing slash, which would fail every
  // page carrying <link rel="manifest" href="/site.webmanifest">.
  const errors = checkInternalLinks('<link rel="manifest" href="/site.webmanifest">', {
    path: 'x.html',
    rootDir: '.',
  });
  assert.ok(
    !errors.some((e) => e.includes('trailing slash')),
    `/site.webmanifest must not be reported as needing a trailing slash, got: ${JSON.stringify(errors)}`,
  );
});
