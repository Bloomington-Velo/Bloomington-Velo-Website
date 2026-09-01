// Static checks for .htaccess. This file is never exercised by Apache in
// this test run -- these checks cover what CAN be verified without a real
// server. Task 15 is responsible for confirming the headers actually
// arrive on staging (mod_headers / mod_expires silently no-op if missing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectHtmlFiles } from '../tools/verify.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htaccess = readFileSync(resolve(ROOT, '.htaccess'), 'utf8');
const verifySrc = readFileSync(resolve(ROOT, 'tools/verify.mjs'), 'utf8');

function extractOrigin(url) {
  const m = url.match(/^(https?:\/\/[^/]+)/);
  return m ? m[1] : null;
}

// Every external origin the nine real pages (plus the client-side JS that
// calls the Google Calendar API) actually load a resource from. Deliberately
// excludes plain <a href> navigations -- those aren't governed by the
// resource-loading CSP directives this file sets, so instagram.com,
// dumondetech.com, charity.gofundme.com, etc. are not expected here.
function externalOriginsReferenced() {
  const origins = new Set();

  for (const file of collectHtmlFiles(ROOT)) {
    const html = readFileSync(file, 'utf8');

    const tagRe = /<(?:img|iframe|script)\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi;
    for (const m of html.matchAll(tagRe)) {
      const origin = extractOrigin(m[1]);
      if (origin) origins.add(origin);
    }

    const linkRe = /<link\b[^>]*\bhref="(https?:\/\/[^"]+)"/gi;
    for (const m of html.matchAll(linkRe)) {
      const origin = extractOrigin(m[1]);
      if (origin) origins.add(origin);
    }
  }

  // Fetch/XHR endpoints hardcoded in client-side JS aren't visible from the
  // HTML scan above but still need connect-src coverage.
  for (const rel of ['assets/js/rides.js', 'assets/js/rides-init.js']) {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    for (const m of src.matchAll(/https?:\/\/[a-zA-Z0-9.-]+/g)) {
      const origin = extractOrigin(m[0]);
      if (origin) origins.add(origin);
    }
  }

  // The site's own canonical origin is covered by 'self', not an explicit
  // source entry.
  origins.delete('https://bloomingtonvelo.org');
  return origins;
}

test('the Route Library redirect appears before the catch-all rule', () => {
  const routeLibraryIndex = htaccess.indexOf('team/ride-library');
  const catchAllIndex = htaccess.indexOf('RewriteRule ^ / [R=301,L]');
  assert.ok(routeLibraryIndex !== -1, 'Route Library rule not found');
  assert.ok(catchAllIndex !== -1, 'catch-all rule not found');
  assert.ok(
    routeLibraryIndex < catchAllIndex,
    'Route Library redirect must appear before the catch-all, or the catch-all swallows it to the homepage',
  );
});

test('the retired-content extension pattern is {2,12} and matches tools/verify.mjs', () => {
  const htaccessMatch = htaccess.match(/REQUEST_URI\}\s+!\\\.\[a-zA-Z0-9\]\{(\d+),(\d+)\}\$/);
  const verifyMatch = verifySrc.match(/\\\.\[a-zA-Z0-9\]\{(\d+),(\d+)\}\$/);
  assert.ok(htaccessMatch, '.htaccess extension-check pattern not found');
  assert.ok(verifyMatch, 'tools/verify.mjs extension pattern not found');
  assert.equal(htaccessMatch[1], '2');
  assert.equal(htaccessMatch[2], '12');
  assert.equal(
    `${htaccessMatch[1]},${htaccessMatch[2]}`,
    `${verifyMatch[1]},${verifyMatch[2]}`,
    '.htaccess and tools/verify.mjs must agree on the extension-length bound, or a missing .webmanifest 301s instead of 404ing',
  );
});

test('the CSP names every external origin the site actually references', () => {
  const cspMatch = htaccess.match(/Content-Security-Policy\s+"([^"]+)"/);
  assert.ok(cspMatch, 'Content-Security-Policy header not found');
  const csp = cspMatch[1];

  const referenced = externalOriginsReferenced();
  assert.ok(referenced.size > 0, 'sanity check: the scan should find at least one external origin');

  for (const origin of referenced) {
    assert.ok(csp.includes(origin), `CSP is missing an origin the site references: ${origin}`);
  }
});

test("script-src does not contain 'unsafe-inline'", () => {
  const cspMatch = htaccess.match(/Content-Security-Policy\s+"([^"]+)"/);
  assert.ok(cspMatch, 'Content-Security-Policy header not found');
  const scriptSrcMatch = cspMatch[1].match(/script-src ([^;]+);/);
  assert.ok(scriptSrcMatch, 'script-src directive not found');
  assert.ok(
    !scriptSrcMatch[1].includes("'unsafe-inline'"),
    "script-src must not allow 'unsafe-inline' -- the one inline script every page ships (the .js-nav " +
      'class-adder in <head>, see docs/audit-2026-08.md) is allowed by exact SHA-256 hash instead, so an ' +
      'injected inline script still will not execute',
  );
});

test('the staging noindex block is present and keyed on the dev host', () => {
  assert.match(
    htaccess,
    /<If "%\{HTTP_HOST\} == 'dev\.bloomingtonvelo\.org'">/,
    'staging noindex block must be keyed on dev.bloomingtonvelo.org, since production and staging share this file',
  );
  assert.match(
    htaccess,
    /X-Robots-Tag\s+"noindex, nofollow"/,
    'staging noindex block must set X-Robots-Tag: noindex, nofollow',
  );
});
