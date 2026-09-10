#!/usr/bin/env node
// Offline structural checks for the static site. Zero dependencies.
// Usage: node tools/verify.mjs [rootDir]
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', 'tools', 'tests', '_design', '.superpowers']);

export function collectHtmlFiles(rootDir) {
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.html')) out.push(full);
    }
  })(rootDir);
  return out.sort();
}

export function expectedCanonical(path) {
  const p = path.split('\\').join('/');
  if (p === 'index.html') return '/';
  if (p === '404.html') return '/404.html';
  if (p.endsWith('/index.html')) return '/' + p.slice(0, -'index.html'.length);
  return '/' + p;
}

// Team member bios (roster-card__bio) are carried over byte-for-byte from
// old WordPress content and must never be edited to satisfy a lint rule —
// see _source/roster.json and team/index.html. Some of that verbatim markup
// (WordPress's auto-inserted emoji <img> tags, in particular) has no
// width/height attributes and never will. Find the balanced extent of each
// bio block with a depth counter — a naive `[\s\S]*?</div>` regex stops at
// the FIRST nested </div> and would both mis-scope this exemption and risk
// the exact silent-truncation bug this project has already shipped once.
//
// FAILS CLOSED: if a bio's <div>s never balance back to depth 0 — an
// unclosed <div> in hand-pasted bio content, or a `<div`-shaped substring
// inside a comment or attribute value throwing the depth counter off by
// one — the old code let `end` default to html.length, silently exempting
// every <img> for the rest of the document from the width/height rule with
// no warning. That is strictly worse than the greedy-regex bug this
// exemption replaced, which at least failed loudly. Instead: treat any
// unbalanced bio as a reported defect and exempt NOTHING in the file, so a
// dimensionless <img> anywhere else still gets caught.
function bioBlockRanges(html) {
  const ranges = [];
  let unbalanced = false;
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
      if (depth === 0) { end = tm.index + tm[0].length; break; }
    }
    if (end === null) {
      // Never balanced back to 0 before the document ran out. Don't guess.
      unbalanced = true;
      break;
    }
    ranges.push([om.index, end]);
    openRe.lastIndex = end;
  }
  return { ranges: unbalanced ? [] : ranges, unbalanced };
}

const insideAny = (ranges, index) => ranges.some(([start, end]) => index >= start && index < end);

export function checkDocument(html, { path }) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };

  need(/^\s*<!doctype html>/i.test(html), 'missing <!doctype html>');
  need(/<html[^>]+lang="[a-z-]+"/i.test(html), 'missing lang attribute on <html>');
  need(/<meta charset="utf-8">/i.test(html), 'missing <meta charset="utf-8">');
  need(/<meta name="viewport"/i.test(html), 'missing viewport meta');
  need(/<title>[^<]{5,70}<\/title>/i.test(html), 'missing or bad-length <title> (5-70 chars)');
  need(/<meta name="description" content="[^"]{50,160}"/i.test(html),
       'missing meta description, or not 50-160 chars');

  const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)"/i);
  if (!canonicalMatch) {
    errors.push('missing canonical link');
  } else {
    const expected = `https://bloomingtonvelo.org${expectedCanonical(path)}`;
    if (canonicalMatch[1] !== expected) {
      errors.push(`canonical link is ${canonicalMatch[1]}, expected ${expected}`);
    }
  }

  need(/<meta property="og:title"/i.test(html), 'missing og:title');
  need(/<meta property="og:image"/i.test(html), 'missing og:image');

  const h1s = html.match(/<h1[\s>]/gi) || [];
  need(h1s.length === 1, `expected exactly one <h1>, found ${h1s.length}`);

  for (const tag of html.match(/<iframe\b[^>]*>/gi) || []) {
    need(/loading="lazy"/i.test(tag), `iframe missing loading="lazy": ${tag.slice(0, 70)}`);
    need(/title="[^"]+"/i.test(tag), `iframe missing title attribute: ${tag.slice(0, 70)}`);
  }

  const { ranges: bioRanges, unbalanced: bioUnbalanced } = bioBlockRanges(html);
  if (bioUnbalanced) {
    errors.push(
      `unbalanced roster-card__bio block in ${path} — its <div>s never close ` +
      `(directly, or a <div>-shaped comment/attribute threw off the counter); ` +
      `exempting no images in this file from the width/height rule until it's fixed`,
    );
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    need(/alt="/i.test(tag), `img missing alt: ${tag.slice(0, 70)}`);
    // Verbatim bio content is exempt from width/height — see bioBlockRanges.
    if (!insideAny(bioRanges, m.index)) {
      need(/width="\d+"/i.test(tag) && /height="\d+"/i.test(tag),
           `img missing width/height: ${tag.slice(0, 70)}`);
    }
  }

  for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/gi) || []) {
    need(/rel="[^"]*noopener/i.test(tag), `target=_blank link missing rel=noopener: ${tag.slice(0, 70)}`);
  }

  return { path, errors };
}

export function checkInternalLinks(html, { path, rootDir }) {
  const errors = [];
  const hrefs = [...html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)].map((m) => m[1]);
  for (const href of new Set(hrefs)) {
    if (!/\.[a-zA-Z0-9]{2,12}$/.test(href) && !href.endsWith('/')) {
      errors.push(`internal link ${href} must end with a trailing slash`);
      continue;
    }
    const target = href.endsWith('/') ? join(rootDir, href, 'index.html') : join(rootDir, href);
    if (!existsSync(target)) errors.push(`broken internal link ${href} (expected ${relative(rootDir, target)})`);
  }
  return errors;
}

function main() {
  const rootDir = resolve(process.argv[2] ?? '.');
  const files = collectHtmlFiles(rootDir);
  if (files.length === 0) {
    console.error('verify: no HTML files found');
    process.exit(1);
  }
  let failed = 0;
  for (const file of files) {
    const rel = relative(rootDir, file);
    const html = readFileSync(file, 'utf8');
    const errors = [
      ...checkDocument(html, { path: rel }).errors,
      ...checkInternalLinks(html, { path: rel, rootDir }),
    ];
    if (errors.length) {
      failed++;
      console.error(`\nFAIL ${rel}`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.log(`ok   ${rel}`);
    }
  }
  console.log(`\n${files.length} file(s) checked, ${failed} failing`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verify.mjs')) main();
