#!/usr/bin/env node
// Offline structural checks for the static site. Zero dependencies.
// Usage: node tools/verify.mjs [rootDir]
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', 'tools', 'tests', '_design']);

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
  need(/<link rel="canonical" href="https:\/\/bloomingtonvelo\.org/i.test(html),
       'missing absolute canonical link');
  need(/<meta property="og:title"/i.test(html), 'missing og:title');
  need(/<meta property="og:image"/i.test(html), 'missing og:image');

  const h1s = html.match(/<h1[\s>]/gi) || [];
  need(h1s.length === 1, `expected exactly one <h1>, found ${h1s.length}`);

  for (const tag of html.match(/<iframe\b[^>]*>/gi) || []) {
    need(/loading="lazy"/i.test(tag), `iframe missing loading="lazy": ${tag.slice(0, 70)}`);
    need(/title="[^"]+"/i.test(tag), `iframe missing title attribute: ${tag.slice(0, 70)}`);
  }

  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    need(/alt="/i.test(tag), `img missing alt: ${tag.slice(0, 70)}`);
    need(/width="\d+"/i.test(tag) && /height="\d+"/i.test(tag),
         `img missing width/height: ${tag.slice(0, 70)}`);
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
