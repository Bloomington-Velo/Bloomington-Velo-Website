// Site-wide SEO checks: sitemap completeness, uniqueness of the strings
// that show up in a Google result, and no leftover WordPress paths.
//
// Pages are discovered from the filesystem via the same walker verify.mjs
// uses, so a page added later is covered automatically instead of silently
// missing from the sitemap or duplicating another page's title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHtmlFiles } from '../tools/verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Normalise a filesystem path to forward slashes so this test behaves the
// same on Windows (backslashes) as on POSIX.
const toPosix = (p) => p.split('\\').join('/');

const pages = collectHtmlFiles(ROOT).filter((f) => !f.endsWith('404.html'));

test('there are exactly eight indexable pages', () => {
  assert.equal(
    pages.length,
    8,
    `expected 8 indexable pages, found ${pages.length}: ${pages.map((f) => relative(ROOT, f)).join(', ')}`,
  );
});

test('every page title is unique', () => {
  const titles = pages.map((f) => readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)[1]);
  assert.equal(new Set(titles).size, titles.length, `duplicate titles: ${titles.join(' | ')}`);
});

test('every meta description is unique', () => {
  const ds = pages.map(
    (f) => readFileSync(f, 'utf8').match(/<meta name="description" content="([^"]*)"/)[1],
  );
  assert.equal(new Set(ds).size, ds.length, `duplicate descriptions: ${ds.join(' | ')}`);
});

test('every page canonical matches its own path', () => {
  for (const f of pages) {
    const rel = toPosix(relative(ROOT, dirname(f)));
    const path = rel === '' ? '/' : `/${rel}/`;
    const canonical = readFileSync(f, 'utf8').match(/<link rel="canonical" href="([^"]*)"/)[1];
    assert.equal(
      canonical,
      `https://bloomingtonvelo.org${path}`,
      `wrong canonical in ${relative(ROOT, f)}`,
    );
  }
});

test('the sitemap lists every indexable page and nothing else', () => {
  const xml = readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = pages
    .map((f) => {
      const rel = toPosix(relative(ROOT, dirname(f)));
      return rel === '' ? 'https://bloomingtonvelo.org/' : `https://bloomingtonvelo.org/${rel}/`;
    })
    .sort();
  assert.deepEqual(locs, expected);
});

// team/index.html carries member bios (roster-card__bio) verbatim from the
// old WordPress site, byte-for-byte — see tools/verify.mjs, which grants the
// same content the same exemption from the <img> width/height rule. One
// 2021 bio links a member's own Everesting badge photo, which is still
// hosted on the legacy WordPress uploads folder, so it legitimately
// contains "wp-content". Rather than disable this check for that one file,
// confine the exemption to verbatim bio blocks specifically, so a
// hand-authored page (or a bio-block edit that introduces a NEW wp-content
// reference) still fails loudly.
function bioBlockRanges(html) {
  const ranges = [];
  const openRe = /<div class="roster-card__bio">/g;
  const tagRe = /<(\/?)div\b[^>]*>/gi;
  let om;
  while ((om = openRe.exec(html))) {
    let depth = 1;
    tagRe.lastIndex = om.index + om[0].length;
    let end = null;
    let tm;
    while ((tm = tagRe.exec(html))) {
      depth += tm[1] === '' ? 1 : -1;
      if (depth === 0) {
        end = tm.index + tm[0].length;
        break;
      }
    }
    if (end === null) break; // unbalanced: exempt nothing
    ranges.push([om.index, end]);
    openRe.lastIndex = end;
  }
  return ranges;
}

test('no shipped page references old WordPress paths outside a verbatim bio', () => {
  for (const f of collectHtmlFiles(ROOT)) {
    const html = readFileSync(f, 'utf8');
    const bioRanges = bioBlockRanges(html);
    const insideBio = (i) => bioRanges.some(([s, e]) => i >= s && i < e);
    for (const m of html.matchAll(/wp-content/g)) {
      assert.ok(
        insideBio(m.index),
        `${relative(ROOT, f)} references wp-content outside a verbatim bio block`,
      );
    }
    assert.ok(
      !html.includes('team/ride-library'),
      `${relative(ROOT, f)} still references the old team/ride-library path`,
    );
  }
});
