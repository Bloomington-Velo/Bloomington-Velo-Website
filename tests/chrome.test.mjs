// Guards the one risk the copy-not-include architecture carries: silent drift.
//
// Every page is a hand-maintained COPY of docs/page-template.html. Nothing at
// runtime keeps the eight copies in step, so these tests do it instead. The
// header, the footer and the shared asset links must match the template on
// every page; the only difference any page is allowed to have is the single
// aria-current="page" marking its own nav entry.
//
// Pages are discovered from the filesystem with the same walker tools/verify.mjs
// uses, so a page added later is covered automatically and cannot slip through
// by not being on a list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHtmlFiles, expectedCanonical } from '../tools/verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_PATH = join(ROOT, 'docs', 'page-template.html');

// Git may check these files out with CRLF. Line endings are not drift.
const norm = (s) => s.replace(/\r\n/g, '\n');

const read = (p) => norm(readFileSync(p, 'utf8'));

function block(html, tag, where) {
  const m = html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`));
  assert.ok(m, `${where}: no <${tag}> block found`);
  return m[0];
}

// The one intended difference between a page's header and the template's.
const stripCurrent = (s) => s.replace(/\s+aria-current="page"/g, '');

// Name the file and point at the exact line, so a failure is actionable
// instead of being two 40-line blobs the reader has to diff by eye.
function describeDrift(label, file, expected, actual) {
  const E = expected.split('\n');
  const A = actual.split('\n');
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
  return lines.join('\n');
}

const template = read(TEMPLATE_PATH);
const templateHeader = block(template, 'header', 'docs/page-template.html');
const templateFooter = block(template, 'footer', 'docs/page-template.html');

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
