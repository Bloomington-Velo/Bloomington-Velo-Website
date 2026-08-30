// Guards the one risk the copy-not-include architecture carries: silent drift.
//
// Every page is a hand-maintained COPY of docs/page-template.html. Nothing at
// runtime keeps the eight copies in step, so these tests do it instead. The
// header, the shared <head>, the footer and the shared asset links must match
// the template on every page; the only differences any page is allowed are the
// single aria-current="page" marking its own nav entry and the six per-page
// <head> fields listed in PER_PAGE_HEAD.
//
// The boundary against tools/verify.mjs: verify.mjs owns PER-PAGE correctness
// (is this title a sane length, is this canonical right for this path).
// This file owns the complementary property — the parts that are supposed to
// be IDENTICAL still are. They answer different questions and do not overlap.
//
// Pages are discovered from the filesystem with the same walker verify.mjs
// uses, so a page added later is covered automatically and cannot slip through
// by not being on a list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHtmlFiles, expectedCanonical } from '../tools/verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = join(ROOT, 'docs', 'page-template.html');
const NL = String.fromCharCode(10);

// Git may check these files out with CRLF. Line endings are not drift.
const norm = (s) => s.replace(/\r\n/g, NL);

const read = (p) => norm(readFileSync(p, 'utf8'));

function block(html, tag, where) {
  const m = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`));
  assert.ok(m, `${where}: no <${tag}> block found`);
  return m[0];
}

// The one intended difference between a page's header and the template's.
const stripCurrent = (s) => s.replace(/\s+aria-current="page"/g, '');

// The six <head> fields that are SUPPOSED to differ per page. Both sides are
// rewritten to the same placeholder, so the comparison is about the invariant
// chrome only and line numbers survive for the diff report. Everything else in
// the head — og:type, og:site_name, og:image, twitter:card, theme-color, the
// icon links, the manifest link, the stylesheet link — must match byte for byte.
const PER_PAGE_HEAD = [
  [/<title>[\s\S]*?<\/title>/, '<title>@@PER-PAGE@@</title>'],
  [/<meta name="description" content="[\s\S]*?">/, '<meta name="description" content="@@PER-PAGE@@">'],
  [/<link rel="canonical" href="[\s\S]*?">/, '<link rel="canonical" href="@@PER-PAGE@@">'],
  [/<meta property="og:title" content="[\s\S]*?">/, '<meta property="og:title" content="@@PER-PAGE@@">'],
  [/<meta property="og:description" content="[\s\S]*?">/, '<meta property="og:description" content="@@PER-PAGE@@">'],
  [/<meta property="og:url" content="[\s\S]*?">/, '<meta property="og:url" content="@@PER-PAGE@@">'],
];

const normaliseHead = (head) =>
  PER_PAGE_HEAD.reduce((acc, [re, placeholder]) => acc.replace(re, placeholder), head);

// Colours retired from the brand. A palette retirement is a one-way door: the
// old value must not survive anywhere that ships, including the places CSS
// never touches — <meta name="theme-color"> and the manifest's "theme_color" —
// which is exactly where #132856 was still shipping after the stylesheet had
// been fully recoloured. _design/ is exempt: those are archived mockups and are
// meant to preserve the old palette.
const RETIRED_COLOURS = [
  { value: '#132856', note: 'the pre-2026 brand navy, replaced by --navy #17233B' },
];

// Name the file and point at the exact line, so a failure is actionable
// instead of being two 40-line blobs the reader has to diff by eye.
function describeDrift(label, file, expected, actual) {
  const E = expected.split(NL);
  const A = actual.split(NL);
  const lines = [`${file}: ${label} has drifted from docs/page-template.html`];
  let shown = 0;
  for (let i = 0; i < Math.max(E.length, A.length) && shown < 3; i++) {
    if (E[i] === A[i]) continue;
    shown++;
    lines.push(
      `  line ${i + 1} of the ${label} block:`,
      `    template: ${E[i] === undefined ? '<no such line>' : JSON.stringify(E[i].trim())}`,
      `    ${file}: ${A[i] === undefined ? '<no such line>' : JSON.stringify(A[i].trim())}`,
    );
  }
  if (shown === 0) {
    lines.push(`  blocks match line for line but differ in length ` +
               `(template ${E.length} lines, ${file} ${A.length} lines)`);
  }
  lines.push('  Fix by re-copying the chrome from docs/page-template.html.');
  return lines.join(NL);
}

const template = read(TEMPLATE_PATH);
const templateHeader = block(template, 'header', 'docs/page-template.html');
const templateFooter = block(template, 'footer', 'docs/page-template.html');
const templateHead = normaliseHead(block(template, 'head', 'docs/page-template.html'));

// The nav's own hrefs, taken from the template rather than hardcoded, so this
// stays correct when a nav entry is added or a URL changes.
const NAV_HREFS = [...templateHeader.matchAll(/<li><a href="(\/[^"]*)"/g)].map((m) => m[1]);

// Assets every page must load. Taken from the template for the same reason.
const SHARED_LINKS = [
  '/assets/css/site.css',
  '/assets/js/nav.js',
  '/site.webmanifest',
];

const pages = collectHtmlFiles(ROOT).map((file) => ({
  file,
  rel: relative(ROOT, file).split('\\').join('/'),
  html: read(file),
}));

test('the template exposes the nav hrefs and the pages were discovered', () => {
  assert.ok(pages.length > 0, 'no HTML pages were discovered under the site root');
  assert.ok(NAV_HREFS.length > 0, 'no nav links found in the template header');
  for (const href of SHARED_LINKS) {
    assert.ok(
      template.includes(`"${href}"`),
      `docs/page-template.html no longer links ${href}; update SHARED_LINKS if that is intended`,
    );
  }
});

for (const { rel, html } of pages) {
  test(`${rel}: header matches the template apart from aria-current`, () => {
    const pageHeader = stripCurrent(block(html, 'header', rel));
    const want = stripCurrent(templateHeader);
    assert.equal(pageHeader, want, describeDrift('header', rel, want, pageHeader));
  });

  test(`${rel}: shared <head> matches the template`, () => {
    const got = normaliseHead(block(html, 'head', rel));
    assert.equal(got, templateHead, describeDrift('shared <head>', rel, templateHead, got));
  });

  test(`${rel}: footer is byte-identical to the template`, () => {
    const pageFooter = block(html, 'footer', rel);
    assert.equal(
      pageFooter,
      templateFooter,
      describeDrift('footer', rel, templateFooter, pageFooter),
    );
  });

  test(`${rel}: aria-current marks exactly its own nav entry`, () => {
    const own = expectedCanonical(rel);
    const expected = NAV_HREFS.includes(own) ? [own] : [];

    const header = block(html, 'header', rel);
    const marked = [...header.matchAll(/<a\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => /aria-current="page"/.test(tag))
      .map((tag) => (tag.match(/href="([^"]*)"/) || [, '<no href>'])[1]);

    assert.deepEqual(
      marked,
      expected,
      expected.length === 0
        ? `${rel}: this page has no nav entry of its own (its URL ${own} is not in the nav), ` +
          `so it must carry no aria-current="page"; found it on ${JSON.stringify(marked)}`
        : `${rel}: aria-current="page" must sit on exactly the ${own} nav link; ` +
          `found it on ${JSON.stringify(marked)}`,
    );
  });

  test(`${rel}: links the stylesheet, nav.js and the manifest`, () => {
    for (const href of SHARED_LINKS) {
      assert.ok(
        html.includes(`"${href}"`),
        `${rel}: does not link ${href} — re-copy the chrome from docs/page-template.html`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Retired palette
//
// A pure drift check cannot catch this. When #132856 survived the recolour it
// survived CONSISTENTLY, in all eight <meta name="theme-color"> tags and in the
// manifest, so every page agreed with every other page and with the template.
// They were uniformly wrong, and drift checks are blind to that. This case
// asserts the absolute property instead.
// ---------------------------------------------------------------------------

// Everything that ships, PLUS the generators that produce things that ship.
// tools/ does not ship itself, but tools/make-og-image.mjs held #132856 in a
// colour constant for a round after the recolour, and the social card it
// produces is an image — so no text scan of the shipped files could ever have
// found the stale brand. Scanning the generator is the only cheap way to catch
// a retired colour that reaches users as pixels.
//
// Directories are read rather than listed, so a generator or stylesheet added
// later is covered without editing this file. tests/ is deliberately excluded:
// RETIRED_COLOURS above necessarily contains the very strings being searched for.
const dirFiles = (parts, ext) =>
  readdirSync(join(ROOT, ...parts))
    .filter((f) => f.endsWith(ext))
    .map((f) => [...parts, f].join('/'));

const scannedFiles = [
  ...pages.map((p) => p.rel),
  'docs/page-template.html',
  'site.webmanifest',
  ...dirFiles(['assets', 'css'], '.css'),
  ...dirFiles(['assets', 'js'], '.js'),
  ...dirFiles(['tools'], '.mjs'),
];

for (const { value, note } of RETIRED_COLOURS) {
  test(`retired colour ${value} appears in no shipped file or generator`, () => {
    const found = [];
    for (const rel of scannedFiles) {
      read(join(ROOT, rel)).split(NL).forEach((line, i) => {
        if (line.toLowerCase().includes(value.toLowerCase())) {
          found.push(`    ${rel}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    assert.deepEqual(
      found,
      [],
      [
        `${value} is retired (${note}) but still appears in ${found.length} place(s):`,
        ...found,
        '  This is not only a CSS concern: <meta name="theme-color"> and the',
        '  manifest\'s "theme_color" paint browser and PWA chrome, and grepping',
        '  the stylesheet alone will not find them.',
      ].join(NL),
    );
  });
}
