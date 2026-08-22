# bloomingtonvelo.org Static Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WordPress site at bloomingtonvelo.org with an 8-page hand-written static site of HTML, CSS, and vanilla JavaScript that preserves every current URL, the Google Calendar and Strava integrations, the team roster, and the route library.

**Architecture:** Plain files served directly by Apache on Hostinger shared hosting. Each page is a standalone `index.html` in a directory matching its live URL, with the header and footer duplicated rather than templated. The only substantial JavaScript is a Google Calendar agenda that progressively enhances a static schedule already present in the HTML. A handful of zero-dependency Node scripts exist in `tools/` for one-time content migration and for repeatable pre-deploy verification; none of them run at build or request time, because there is no build.

**Tech Stack:** HTML5, CSS3 (custom properties, Grid, Flexbox), ES modules. Node 22 for dev tooling only (`node --test`, `npx serve`). Apache `.htaccess`. Google Calendar API v3. Strava club widget iframe.

**Spec:** `docs/superpowers/specs/2026-08-22-bloomingtonvelo-static-rebuild-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No runtime or build dependencies.** The deployed site must contain zero `node_modules`, zero bundlers, zero preprocessors. Dev-time tooling invoked through `npx --yes` is permitted; nothing it produces may be required to serve the site.
- **No build step.** The repository contents are byte-for-byte what Apache serves from `public_html`.
- **URL parity.** These eight URLs must exist exactly, each as a directory containing `index.html`: `/`, `/team/`, `/team/ride-library/`, `/ride/`, `/ride/calendar/`, `/sponsors/`, `/contact/`, `/privacy-policy/`. Plus `/404.html`.
- **Brand:** navy `#132856`. Existing BV square logo, unchanged.
- **Calendar ID:** `r5lf3al9blontcsjnedbr2f2u0@group.calendar.google.com` (public).
- **Time zone:** `America/Indiana/Indianapolis`.
- **Strava club:** id `329602`, widget token `ae47281f0af190641e17e6240c59a40c124d670c`.
- **Club email:** `bloomingtonvelocycling@gmail.com`.
- **Content counts (assert these; a mismatch means the source page changed):** 34 roster members, 17 with bios, 13 with photos. 51 routes across four groups — Team Favorites 3, 30–44 Miles 9, 45–64 Miles 31, 65+ Miles 8.
- **Performance budget:** under 100 KB of first-party assets per page. All third-party iframes `loading="lazy"`.
- **Accessibility:** WCAG AA contrast, visible focus, keyboard-operable nav, one `<h1>` per page.
- **Roster bios are carried over verbatim.** Do not shorten, rewrite, or "improve" any member's bio.
- **Commit style:** conventional commits (`feat:`, `chore:`, `docs:`, `fix:`).

---

### Task 1: Repository scaffold and offline verification harness

Establishes the directory structure and, critically, the checking script that every later task runs. Building the checker first means every subsequent page is verified the moment it exists.

**Files:**
- Create: `.gitignore`, `README.md`, `index.html`, `assets/css/site.css`, `assets/js/.gitkeep`, `assets/img/.gitkeep`
- Create: `tools/verify.mjs`
- Create: `tests/verify.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `tools/verify.mjs` exports `checkDocument(html, { path })` returning `{ path, errors: string[] }`, and `collectHtmlFiles(rootDir)` returning `string[]` of absolute paths. Run as `node tools/verify.mjs` it scans the repo root and exits 1 if any document has errors. Later tasks rely on this exact invocation.

- [ ] **Step 1: Write the failing test**

Create `tests/verify.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDocument } from '../tools/verify.mjs';

const GOOD = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Team | Bloomington Velo</title>
<meta name="description" content="Meet the riders of Bloomington Velo.">
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../tools/verify.mjs'`.

- [ ] **Step 3: Write `tools/verify.mjs`**

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/`
Expected: PASS, 11 tests.

- [ ] **Step 5: Create the scaffold files**

`.gitignore` — append to the existing file so it reads:

```
node_modules/
.DS_Store
Thumbs.db
*.log
_source/raw/
```

`index.html` — a minimal placeholder that satisfies the verifier; it is replaced wholesale in Task 6:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bloomington Velo | Cycling Club</title>
<meta name="description" content="Bloomington Velo is a performance-oriented cycling club in Bloomington, Indiana, with an emphasis on racing, training, and rider development.">
<link rel="canonical" href="https://bloomingtonvelo.org/">
<meta property="og:title" content="Bloomington Velo | Cycling Club">
<meta property="og:image" content="https://bloomingtonvelo.org/assets/img/og-default.jpg">
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
<main><h1>Bloomington Velo</h1></main>
</body>
</html>
```

`assets/css/site.css` — a single comment line for now: `/* Bloomington Velo — see Task 5 */`

Create empty `assets/js/.gitkeep` and `assets/img/.gitkeep`.

- [ ] **Step 6: Write `README.md`**

Must contain, at minimum:

- What this repo is and that **it has no build step** — files are served exactly as committed.
- Local preview: `npx --yes serve .` then open `http://localhost:3000`. Explain that `file://` will not work because `fetch` and root-absolute paths need a real origin.
- Verify: `node tools/verify.mjs` and `node --test tests/`.
- **"Adding a page" checklist:** copy `docs/page-template.html` (created in Task 5), fill every `<!-- SLOT: ... -->` marker, add the URL to `sitemap.xml`, add a nav link to all 8 existing pages, run `node tools/verify.mjs`.
- **"Adding a roster member" checklist:** copy an existing `<article class="roster-card">` block in `team/index.html`, fill it in, add the photo to `assets/img/team/`.
- **"Adding a sponsor" checklist:** copy the sponsor block in `sponsors/index.html`.
- Deploy: push to `main`; Hostinger pulls automatically.
- Where the Google Calendar API key lives and how to rotate it.

- [ ] **Step 7: Run the full verification**

Run: `node --test tests/ && node tools/verify.mjs`
Expected: tests PASS; verify prints `ok   index.html` and `1 file(s) checked, 0 failing`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold static site and offline verification harness"
```

---

### Task 2: Extract roster and route content from the live WordPress site

A one-time migration. The extractor asserts the counts from Global Constraints so a silently-changed source page fails loudly rather than producing a short roster.

**Files:**
- Create: `tools/extract-content.mjs`
- Create: `tests/extract-content.test.mjs`
- Create (generated): `_source/roster.json`, `_source/routes.json`
- Create (downloaded): `assets/img/team/*.jpg`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `_source/roster.json` — `Array<{ first: string, last: string, photo: string|null, bioHtml: string|null }>`, 34 entries, source order preserved. `photo` is a repo-relative path like `/assets/img/team/brauner.jpg`.
  - `_source/routes.json` — `Array<{ group: string, routes: Array<{ name: string, url: string, description: string }> }>`, 4 groups, 51 routes total.
  - `tools/extract-content.mjs` exports `parseRoster(html)` and `parseRoutes(html)` for testing.

- [ ] **Step 1: Write the failing test**

Create `tests/extract-content.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster, parseRoutes } from '../tools/extract-content.mjs';

const ROSTER_HTML = `
<div class="tmm_container"><div class="tmm_member" style="border-top:#333333 solid 5px;">
<div class="tmm_photo tmm_pic_x_5" style="background: url(https://bloomingtonvelo.org/wp-content/uploads/brauner.jpg); margin-left:auto;"></div>
<div class="tmm_textblock"><div class="tmm_names"><span class="tmm_fname">Michael</span> <span class="tmm_lname">Brauner</span></div>
<div class="tmm_desc" style="text-align:"><p style="line-height: 1.7"><strong>Residence:</strong> Bloomington</p></div>
</div></div></div>
<div class="tmm_container"><div class="tmm_member">
<div class="tmm_photo tmm_pic_x_6" style="background: url(); "></div>
<div class="tmm_textblock"><div class="tmm_names"><span class="tmm_fname">Jane</span> <span class="tmm_lname">Doe</span></div>
</div></div></div>`;

test('parseRoster extracts one entry per tmm_member', () => {
  assert.equal(parseRoster(ROSTER_HTML).length, 2);
});

test('parseRoster reads first and last name', () => {
  const [m] = parseRoster(ROSTER_HTML);
  assert.equal(m.first, 'Michael');
  assert.equal(m.last, 'Brauner');
});

test('parseRoster maps a photo to a local asset path', () => {
  assert.equal(parseRoster(ROSTER_HTML)[0].photo, '/assets/img/team/brauner.jpg');
});

test('parseRoster yields null photo when the background url is empty', () => {
  assert.equal(parseRoster(ROSTER_HTML)[1].photo, null);
});

test('parseRoster keeps bio HTML verbatim', () => {
  assert.match(parseRoster(ROSTER_HTML)[0].bioHtml, /<strong>Residence:<\/strong> Bloomington/);
});

test('parseRoster yields null bio when tmm_desc is absent', () => {
  assert.equal(parseRoster(ROSTER_HTML)[1].bioHtml, null);
});

const ROUTES_HTML = `
<h2 id="at-1" class="c-accordion__title js-accordion-controller">Team Favorites</h2>
<div><ul><li><a href="https://www.strava.com/routes/111">Bean Blossom</a> &#8211; Rolling and pretty</li></ul></div>
<h2 id="at-2" class="c-accordion__title js-accordion-controller">30 &#8211; 44 Miles</h2>
<div><ul>
<li><a href="https://ridewithgps.com/routes/222">Unionville</a> &#8211; Short and sharp</li>
<li><a href="https://www.strava.com/routes/333">Harrodsburg</a></li>
</ul></div>`;

test('parseRoutes returns one entry per h2 group', () => {
  assert.equal(parseRoutes(ROUTES_HTML).length, 2);
});

test('parseRoutes decodes HTML entities in group names', () => {
  assert.equal(parseRoutes(ROUTES_HTML)[1].group, '30 – 44 Miles');
});

test('parseRoutes captures name, url and description', () => {
  const r = parseRoutes(ROUTES_HTML)[0].routes[0];
  assert.deepEqual(r, {
    name: 'Bean Blossom',
    url: 'https://www.strava.com/routes/111',
    description: 'Rolling and pretty',
  });
});

test('parseRoutes tolerates a route with no description', () => {
  assert.equal(parseRoutes(ROUTES_HTML)[1].routes[1].description, '');
});

test('parseRoutes assigns routes to the correct group', () => {
  assert.equal(parseRoutes(ROUTES_HTML)[1].routes.length, 2);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/extract-content.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `tools/extract-content.mjs`**

```js
#!/usr/bin/env node
// One-time migration: pull roster and route content out of the live WordPress
// site into _source/*.json and download member photos. NOT a build step.
// Usage: node tools/extract-content.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const TEAM_URL = 'https://bloomingtonvelo.org/team/';
const ROUTES_URL = 'https://bloomingtonvelo.org/team/ride-library/';

const EXPECTED = {
  members: 34,
  bios: 17,
  photos: 13,
  groups: [
    ['Team Favorites', 3],
    ['30 – 44 Miles', 9],
    ['45 – 64 Miles', 31],
    ['65 + Miles', 8],
  ],
};

export function decodeEntities(s) {
  return s
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, '\u2019').replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .trim();
}

export function parseRoster(html) {
  const blocks = html.split(/<div class="tmm_member"/).slice(1);
  return blocks.map((block) => {
    const first = block.match(/<span class="tmm_fname">([^<]*)<\/span>/)?.[1] ?? '';
    const last = block.match(/<span class="tmm_lname">([^<]*)<\/span>/)?.[1] ?? '';
    const rawPhoto = block.match(/background:\s*url\(([^)]*)\)/)?.[1]?.trim() ?? '';
    const photo = rawPhoto.startsWith('http') ? `/assets/img/team/${basename(new URL(rawPhoto).pathname)}` : null;
    const desc = block.match(/<div class="tmm_desc"[^>]*>([\s\S]*?)<\/div>/)?.[1]?.trim();
    return {
      first: decodeEntities(first),
      last: decodeEntities(last),
      photo,
      bioHtml: desc ? desc : null,
      photoSource: rawPhoto.startsWith('http') ? rawPhoto : null,
    };
  });
}

export function parseRoutes(html) {
  const headings = [...html.matchAll(/<h2 id="at-\d+"[^>]*>([\s\S]*?)<\/h2>/g)];
  const chunks = html.split(/<h2 id="at-\d+"[^>]*>[\s\S]*?<\/h2>/).slice(1);
  return headings.map((h, i) => {
    const body = chunks[i] ?? '';
    const routes = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].flatMap((li) => {
      const item = li[1];
      const a = item.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!a) return [];
      const after = item.slice(item.indexOf('</a>') + 4);
      const description = decodeEntities(after.replace(/<[^>]*>/g, '')).replace(/^[–—-]\s*/, '').trim();
      return [{ name: decodeEntities(a[2].replace(/<[^>]*>/g, '')), url: a[1], description }];
    });
    return { group: decodeEntities(h[1].replace(/<[^>]*>/g, '')), routes };
  });
}

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'bloomingtonvelo-migration' } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`Count mismatch for ${label}: expected ${expected}, got ${actual}. ` +
      'The source page changed — re-check the plan constraints before continuing.');
  }
}

async function main() {
  mkdirSync('_source', { recursive: true });
  mkdirSync('assets/img/team', { recursive: true });

  const roster = parseRoster(await get(TEAM_URL));
  assertEqual(roster.length, EXPECTED.members, 'roster members');
  assertEqual(roster.filter((m) => m.bioHtml).length, EXPECTED.bios, 'roster bios');
  assertEqual(roster.filter((m) => m.photo).length, EXPECTED.photos, 'roster photos');

  for (const m of roster) {
    if (!m.photoSource) continue;
    const res = await fetch(m.photoSource);
    if (!res.ok) throw new Error(`photo ${m.photoSource} -> ${res.status}`);
    writeFileSync(`.${m.photo}`, Buffer.from(await res.arrayBuffer()));
    console.log(`downloaded ${m.photo}`);
  }

  const groups = parseRoutes(await get(ROUTES_URL));
  assertEqual(groups.length, EXPECTED.groups.length, 'route groups');
  EXPECTED.groups.forEach(([name, count], i) => {
    assertEqual(groups[i].group, name, `group ${i} name`);
    assertEqual(groups[i].routes.length, count, `routes in "${name}"`);
  });

  writeFileSync('_source/roster.json',
    JSON.stringify(roster.map(({ photoSource, ...m }) => m), null, 2) + '\n');
  writeFileSync('_source/routes.json', JSON.stringify(groups, null, 2) + '\n');

  console.log(`\nroster: ${roster.length} members, routes: ${groups.reduce((n, g) => n + g.routes.length, 0)}`);
}

if (process.argv[1]?.endsWith('extract-content.mjs')) main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/extract-content.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the extraction against the live site**

Run: `node tools/extract-content.mjs`
Expected: 13 `downloaded ...` lines, then `roster: 34 members, routes: 51`. If any count assertion throws, **stop and report** — the live page changed and the plan's constants need updating.

- [ ] **Step 6: Optimize the downloaded photos**

Run: `npx --yes sharp-cli --input "assets/img/team/*" --output assets/img/team --format webp --quality 82 resize 480`

Then convert each roster card to `<picture>` in Task 9. If `sharp-cli` is unavailable offline, keep the JPEGs and note the deviation; the budget check in Task 14 will catch it if they are too heavy.

Verify no file exceeds 80 KB: `ls -l assets/img/team/`

- [ ] **Step 7: Commit**

```bash
git add tools/extract-content.mjs tests/extract-content.test.mjs _source assets/img/team
git commit -m "chore: extract roster and route content from WordPress"
```

---

### Task 3: Download and prepare brand assets

**Files:**
- Create: `assets/img/logo.png`, `assets/img/logo-192.png`, `assets/img/favicon.ico`, `assets/img/apple-touch-icon.png`, `assets/img/og-default.jpg`
- Create: `site.webmanifest`

**Interfaces:**
- Consumes: nothing.
- Produces: `/assets/img/logo.png` referenced by the header in Task 5; `/assets/img/og-default.jpg` (1200×630) referenced by every page's `og:image`.

- [ ] **Step 1: Download the existing logo at full size**

```bash
mkdir -p assets/img
curl -sfL "https://bloomingtonvelo.org/wp-content/uploads/2020/12/cropped-BV-2020-Logo-Square-Compressed-270x270.png" -o assets/img/logo.png
curl -sfL "https://bloomingtonvelo.org/wp-content/uploads/2020/12/cropped-BV-2020-Logo-Square-Compressed-192x192.png" -o assets/img/logo-192.png
curl -sfL "https://bloomingtonvelo.org/wp-content/uploads/2020/12/cropped-BV-2020-Logo-Square-Compressed-32x32.png" -o assets/img/favicon-32.png
curl -sfL "https://bloomingtonvelo.org/wp-content/uploads/2020/12/cropped-BV-2020-Logo-Square-Compressed-180x180.png" -o assets/img/apple-touch-icon.png
ls -l assets/img/
```

Expected: four files, none zero-length.

- [ ] **Step 2: Build the OG image**

Create a 1200×630 `assets/img/og-default.jpg`: navy `#132856` background, centered logo, the words "Bloomington Velo" and "Cycling Club · Bloomington, Indiana". If a club photograph is available from the open item in the spec, use it as the background with a navy scrim. Keep the file under 150 KB.

- [ ] **Step 3: Write `site.webmanifest`**

```json
{
  "name": "Bloomington Velo",
  "short_name": "BV",
  "icons": [
    { "src": "/assets/img/logo-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/img/logo.png", "sizes": "270x270", "type": "image/png" }
  ],
  "theme_color": "#132856",
  "background_color": "#ffffff",
  "display": "browser",
  "start_url": "/"
}
```

- [ ] **Step 4: Verify**

Run: `node tools/verify.mjs`
Expected: still `0 failing`.

- [ ] **Step 5: Commit**

```bash
git add assets/img site.webmanifest
git commit -m "chore: add brand assets and web manifest"
```

---

### Task 4: Google Calendar agenda module (pure logic)

The riskiest code in the project, isolated into pure functions so it can be tested without a browser. DOM wiring is Task 7.

**Files:**
- Create: `assets/js/rides.js`
- Create: `tests/rides.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces, all named ESM exports from `assets/js/rides.js`:
  - `CALENDAR_ID: string`
  - `TIME_ZONE: string`
  - `buildEventsUrl({ apiKey: string, now?: Date, maxResults?: number }): string`
  - `parseEvents(payload: object): Array<{ id: string, title: string, location: string, start: Date|null, allDay: boolean }>`
  - `escapeHtml(s: string): string`
  - `renderAgenda(events: Array, opts?: { timeZone?: string }): string` — returns `''` for an empty array.

  Task 7 imports exactly these names.

- [ ] **Step 1: Write the failing test**

Create `tests/rides.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsUrl, parseEvents, renderAgenda, escapeHtml, CALENDAR_ID } from '../assets/js/rides.js';

test('buildEventsUrl percent-encodes the calendar id', () => {
  const url = buildEventsUrl({ apiKey: 'KEY', now: new Date('2026-04-01T12:00:00Z') });
  assert.ok(url.includes(encodeURIComponent(CALENDAR_ID)));
  assert.ok(!url.includes('@group.calendar'));
});

test('buildEventsUrl requests single, time-ordered, future events', () => {
  const url = buildEventsUrl({ apiKey: 'KEY', now: new Date('2026-04-01T12:00:00Z') });
  assert.ok(url.includes('singleEvents=true'));
  assert.ok(url.includes('orderBy=startTime'));
  assert.ok(url.includes(`timeMin=${encodeURIComponent('2026-04-01T12:00:00.000Z')}`));
  assert.ok(url.includes('key=KEY'));
});

test('buildEventsUrl defaults to 8 results and honours an override', () => {
  assert.ok(buildEventsUrl({ apiKey: 'K' }).includes('maxResults=8'));
  assert.ok(buildEventsUrl({ apiKey: 'K', maxResults: 3 }).includes('maxResults=3'));
});

const PAYLOAD = {
  items: [
    { id: 'a', summary: 'Tuesday Night Ride', location: 'Bryan Park', status: 'confirmed',
      start: { dateTime: '2026-04-07T17:45:00-04:00' } },
    { id: 'b', summary: 'Candy Stripe Classic', status: 'confirmed', start: { date: '2026-04-11' } },
    { id: 'c', summary: 'Cancelled Ride', status: 'cancelled', start: { dateTime: '2026-04-08T17:45:00-04:00' } },
    { id: 'd', status: 'confirmed', start: { dateTime: '2026-04-09T17:45:00-04:00' } },
  ],
};

test('parseEvents drops cancelled events', () => {
  assert.ok(!parseEvents(PAYLOAD).some((e) => e.id === 'c'));
});

test('parseEvents marks date-only events as all-day', () => {
  const e = parseEvents(PAYLOAD).find((x) => x.id === 'b');
  assert.equal(e.allDay, true);
});

test('parseEvents marks dateTime events as not all-day', () => {
  assert.equal(parseEvents(PAYLOAD).find((x) => x.id === 'a').allDay, false);
});

test('parseEvents falls back to a default title', () => {
  assert.equal(parseEvents(PAYLOAD).find((x) => x.id === 'd').title, 'Club ride');
});

test('parseEvents returns an empty array for a payload with no items', () => {
  assert.deepEqual(parseEvents({}), []);
});

test('escapeHtml neutralises angle brackets, quotes and ampersands', () => {
  assert.equal(escapeHtml(`<img src=x onerror="a">&'`), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});

test('renderAgenda returns an empty string for no events', () => {
  assert.equal(renderAgenda([]), '');
});

test('renderAgenda escapes event titles and locations', () => {
  const html = renderAgenda(parseEvents({
    items: [{ id: 'x', summary: '<script>bad</script>', location: '"Park"', status: 'confirmed',
              start: { dateTime: '2026-04-07T17:45:00-04:00' } }],
  }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renderAgenda shows a time for timed events in Indiana time', () => {
  const html = renderAgenda(parseEvents(PAYLOAD).filter((e) => e.id === 'a'));
  assert.match(html, /5:45\s?PM/i);
  assert.ok(html.includes('Tuesday Night Ride'));
});

test('renderAgenda omits the time for all-day events', () => {
  const html = renderAgenda(parseEvents(PAYLOAD).filter((e) => e.id === 'b'));
  assert.ok(html.includes('Candy Stripe Classic'));
  assert.ok(!/\d:\d\d\s?(AM|PM)/i.test(html));
});

test('renderAgenda emits one list item per event', () => {
  const html = renderAgenda(parseEvents(PAYLOAD));
  assert.equal((html.match(/<li class="ride"/g) || []).length, 3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/rides.test.mjs`
Expected: FAIL — `Cannot find module '../assets/js/rides.js'`.

- [ ] **Step 3: Write `assets/js/rides.js`**

```js
// Pure logic for the "Next Rides" agenda. No DOM access — see rides-init.js.
export const CALENDAR_ID = 'r5lf3al9blontcsjnedbr2f2u0@group.calendar.google.com';
export const TIME_ZONE = 'America/Indiana/Indianapolis';

const API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export function buildEventsUrl({ apiKey, now = new Date(), maxResults = 8 }) {
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: now.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });
  return `${API_BASE}/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
}

export function parseEvents(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .filter((item) => item?.status !== 'cancelled' && (item?.start?.dateTime || item?.start?.date))
    .map((item) => {
      const allDay = !item.start.dateTime;
      const iso = item.start.dateTime ?? `${item.start.date}T12:00:00Z`;
      const start = new Date(iso);
      return {
        id: item.id ?? iso,
        title: (item.summary ?? '').trim() || 'Club ride',
        location: (item.location ?? '').trim(),
        start: Number.isNaN(start.getTime()) ? null : start,
        allDay,
      };
    })
    .filter((e) => e.start !== null);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAgenda(events, { timeZone = TIME_ZONE } = {}) {
  if (!events.length) return '';
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'short', day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit',
  });

  const items = events.map((event) => {
    const when = dayFmt.format(event.start);
    const time = event.allDay ? '' : `<span class="ride__time">${escapeHtml(timeFmt.format(event.start))}</span>`;
    const place = event.location
      ? `<span class="ride__place">${escapeHtml(event.location)}</span>` : '';
    return `<li class="ride">` +
      `<time class="ride__when" datetime="${event.start.toISOString()}">${escapeHtml(when)}</time>` +
      time +
      `<span class="ride__title">${escapeHtml(event.title)}</span>` +
      place +
      `</li>`;
  });

  return `<ul class="rides">${items.join('')}</ul>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/rides.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Run the whole suite**

Run: `node --test tests/`
Expected: PASS, 36 tests total across three files.

- [ ] **Step 6: Commit**

```bash
git add assets/js/rides.js tests/rides.test.mjs
git commit -m "feat: add Google Calendar agenda logic with tests"
```

---

### Task 5: Design spike — three homepage directions

A human decision gate. Nothing here ships.

**Files:**
- Create: `_design/mockup-a.html`, `_design/mockup-b.html`, `_design/mockup-c.html`, `_design/index.html`

**Interfaces:**
- Consumes: `assets/img/logo.png` from Task 3.
- Produces: a chosen direction, recorded as a note appended to the plan. Tasks 6 onward implement whichever wins.

- [ ] **Step 1: Build three self-contained homepage mockups**

Each is a complete standalone HTML file with inline `<style>` (mockups only — the real site uses an external stylesheet). Each shows the same content — header/nav, hero, "who we are", a Next Rides block with three sample rides, a Strava widget placeholder, and a footer — in a different visual treatment:

- **A — Modern refresh:** navy and white, generous whitespace, restrained type, photo hero with a navy scrim, content in cards.
- **B — Bold athletic:** full-bleed photo hero, oversized condensed headings, a high-visibility accent (e.g. `#F0B323`) against the navy, edge-to-edge sections.
- **C — Minimal utilitarian:** system font stack, near-zero imagery, tight single-column layout, maximum legibility and speed.

Use a neutral placeholder image (a navy `<div>` with the logo) where club photography is missing, so the comparison is about layout and type rather than photo quality.

`_design/index.html` links to all three side by side with a one-line description each.

- [ ] **Step 2: Serve and screenshot**

Run: `npx --yes serve .` and open `http://localhost:3000/_design/`
Capture each mockup at 390px and 1280px wide.

- [ ] **Step 3: Present the three to Tyler and get a decision**

**STOP HERE.** Do not proceed to Task 6 until a direction is chosen. Record the choice by appending a `## Design decision` section to this plan file naming the winner and any requested modifications.

- [ ] **Step 4: Commit**

```bash
git add _design docs/superpowers/plans/2026-08-22-bloomingtonvelo-static-rebuild.md
git commit -m "docs: add homepage design mockups and record chosen direction"
```

---

### Task 6: Design system and the page template

Turns the chosen mockup into the reusable stylesheet and the canonical page chrome. `docs/page-template.html` becomes the source of truth for every page — copied, not included.

**Files:**
- Modify: `assets/css/site.css`
- Create: `assets/js/nav.js`
- Create: `docs/page-template.html`
- Modify: `index.html`

**Interfaces:**
- Consumes: the design direction from Task 5; `assets/img/logo.png` from Task 3.
- Produces:
  - `docs/page-template.html` containing `<!-- SLOT: title -->`, `<!-- SLOT: description -->`, `<!-- SLOT: canonical -->`, `<!-- SLOT: og -->`, `<!-- SLOT: main -->` markers, plus the finished header, nav, and footer.
  - CSS custom properties on `:root`: `--navy`, `--navy-dark`, `--accent`, `--ink`, `--muted`, `--surface`, `--rule`, `--space-1` … `--space-6`, `--measure`, `--radius`.
  - CSS classes the later tasks use: `.wrap`, `.site-header`, `.site-nav`, `.nav-toggle`, `.hero`, `.section`, `.card-grid`, `.roster-card`, `.route-group`, `.route-list`, `.rides`, `.ride`, `.ride__when`, `.ride__time`, `.ride__title`, `.ride__place`, `.embed`, `.sponsor`, `.site-footer`, `.skip-link`, `.visually-hidden`, `.btn`, `.btn--primary`.
  - `assets/js/nav.js` — no exports; attaches the mobile nav toggle on `DOMContentLoaded`.

- [ ] **Step 1: Write `assets/css/site.css`**

Structure it in this order, with a comment banner per section: custom properties → reset → base typography → layout utilities → skip link → header and nav → hero → sections → cards → rides → embeds → footer → `prefers-reduced-motion`.

Requirements:
- `:root` holds every color and spacing value. No hard-coded hex outside `:root`.
- `--navy: #132856`. All body text on white must reach 4.5:1; all text on navy must reach 4.5:1.
- Fluid type via `clamp()`; base `font-size: 1rem`, body copy `max-width: var(--measure)` of about `68ch`.
- Mobile-first. The only breakpoints are `min-width: 48rem` and `min-width: 72rem`.
- Self-hosted variable font in `assets/fonts/` with `font-display: swap`, plus a full system-font fallback stack. If no font file is added, use the system stack alone and delete the `@font-face` rule — do not link Google Fonts.
- `.embed` wraps iframes in a responsive container that reserves height so lazy-loaded iframes cause no layout shift.
- Visible `:focus-visible` outline of at least 2px on every interactive element.
- Wrap all transitions in `@media (prefers-reduced-motion: no-preference)`.

- [ ] **Step 2: Write `assets/js/nav.js`**

```js
// Mobile navigation toggle. Progressive enhancement: with JS off the nav is
// always visible, because .site-nav is only collapsed once .js-nav is set.
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  document.documentElement.classList.add('js-nav');

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.dataset.open = String(open);
  };

  setOpen(false);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
});
```

The stylesheet must collapse `.site-nav` only under `.js-nav`, so a no-JS visitor keeps a working menu.

- [ ] **Step 3: Write `docs/page-template.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><!-- SLOT: title --></title>
<meta name="description" content="<!-- SLOT: description -->">
<link rel="canonical" href="https://bloomingtonvelo.org<!-- SLOT: canonical -->">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bloomington Velo">
<meta property="og:title" content="<!-- SLOT: title -->">
<meta property="og:description" content="<!-- SLOT: description -->">
<meta property="og:url" content="https://bloomingtonvelo.org<!-- SLOT: canonical -->">
<meta property="og:image" content="https://bloomingtonvelo.org/assets/img/og-default.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#132856">
<link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/assets/css/site.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="site-header">
  <div class="wrap site-header__inner">
    <a class="site-header__brand" href="/">
      <img src="/assets/img/logo.png" alt="Bloomington Velo" width="270" height="270" class="site-header__logo">
      <span class="site-header__name">Bloomington Velo</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
      <span class="visually-hidden">Menu</span>
      <span class="nav-toggle__bars" aria-hidden="true"></span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>
        <li><a href="/team/">Team</a></li>
        <li><a href="/ride/">Ride</a></li>
        <li><a href="/ride/calendar/">Calendar</a></li>
        <li><a href="/team/ride-library/">Routes</a></li>
        <li><a href="/sponsors/">Sponsors</a></li>
        <li><a href="/contact/">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>

<main id="main">
<!-- SLOT: main -->
</main>

<footer class="site-footer">
  <div class="wrap site-footer__inner">
    <p class="site-footer__tagline">Bloomington Velo — a performance-oriented cycling club in Bloomington, Indiana.</p>
    <ul class="site-footer__links">
      <li><a href="https://www.instagram.com/bloomingtonvelo/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
      <li><a href="https://www.strava.com/clubs/329602" target="_blank" rel="noopener noreferrer">Strava</a></li>
      <li><a href="mailto:bloomingtonvelocycling@gmail.com">bloomingtonvelocycling@gmail.com</a></li>
      <li><a href="/privacy-policy/">Privacy</a></li>
    </ul>
    <p class="site-footer__legal">&copy; 2026 Bloomington Velo</p>
  </div>
</footer>

<script src="/assets/js/nav.js" defer></script>
</body>
</html>
```

Mark the current page in the nav on each real page with `aria-current="page"`.

- [ ] **Step 4: Rebuild `index.html` from the template**

Copy `docs/page-template.html` to `index.html`, fill the slots (canonical `/`), and put a single `<h1>Bloomington Velo</h1>` plus a placeholder paragraph in the main slot. Full home content is Task 7.

- [ ] **Step 5: Verify**

Run: `node tools/verify.mjs && node --test tests/`
Expected: `1 file(s) checked, 0 failing`; all tests pass.

- [ ] **Step 6: Manual accessibility check**

Serve with `npx --yes serve .`, then:
- Tab from the top: the skip link must appear first and work.
- At 390px wide, the menu button must open and close the nav, and Escape must close it and return focus to the button.
- Disable JavaScript and reload: the nav must still be fully visible and usable.

- [ ] **Step 7: Commit**

```bash
git add assets/css/site.css assets/js/nav.js docs/page-template.html index.html
git commit -m "feat: add design system, page template and site chrome"
```

---

### Task 7: Home page with the Next Rides agenda

**Files:**
- Modify: `index.html`
- Create: `assets/js/rides-init.js`
- Create: `assets/js/config.js`

**Interfaces:**
- Consumes: `buildEventsUrl`, `parseEvents`, `renderAgenda` from `assets/js/rides.js` (Task 4); `docs/page-template.html` (Task 6).
- Produces:
  - `assets/js/config.js` exporting `export const GOOGLE_CALENDAR_API_KEY = '...';` — the single place the key lives.
  - The `#next-rides` container contract: an element with `id="next-rides"` whose existing children are the static fallback schedule, replaced only on a successful fetch. Task 8 reuses this markup verbatim.

- [ ] **Step 1: Create `assets/js/config.js`**

```js
// Public API key, restricted in Google Cloud to the Calendar API and to the
// HTTP referrers bloomingtonvelo.org/* and dev.bloomingtonvelo.org/*.
// Rotating it: see README.
export const GOOGLE_CALENDAR_API_KEY = 'REPLACE_WITH_RESTRICTED_KEY';
```

If Tyler has not yet supplied a key, leave the placeholder. The fallback path must still render correctly, and Task 15 gates on the real key being in place.

- [ ] **Step 2: Write `assets/js/rides-init.js`**

```js
import { buildEventsUrl, parseEvents, renderAgenda } from './rides.js';
import { GOOGLE_CALENDAR_API_KEY } from './config.js';

const CACHE_KEY = `bv-rides-${new Date().toISOString().slice(0, 10)}`;

async function loadEvents() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const res = await fetch(buildEventsUrl({ apiKey: GOOGLE_CALENDAR_API_KEY }));
  if (!res.ok) throw new Error(`calendar ${res.status}`);
  const payload = await res.json();
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  return payload;
}

async function init() {
  const container = document.getElementById('next-rides');
  if (!container || GOOGLE_CALENDAR_API_KEY.startsWith('REPLACE_')) return;

  try {
    const html = renderAgenda(parseEvents(await loadEvents()));
    if (html) {
      container.innerHTML = html;
      container.dataset.source = 'calendar';
    }
  } catch (err) {
    // Leave the static fallback in place. Never blank the container.
    console.warn('Next Rides: falling back to the static schedule.', err);
  }
}

init();
```

The `if (html)` guard and the `catch` that does nothing to the DOM are what guarantee the fallback. Do not add a loading spinner.

- [ ] **Step 3: Write the home page**

Copy `docs/page-template.html` to `index.html` and fill the slots:

- `title`: `Bloomington Velo | Cycling Club in Bloomington, Indiana`
- `description`: `Bloomington Velo is a performance-oriented cycling club in Bloomington, Indiana. Racing, training, and rider development. Join our group rides.`
- `canonical`: `/`

Main content, in order:

1. `.hero` — `<h1>Bloomington Velo</h1>`, a one-line positioning statement, and a primary CTA linking to `/ride/`.
   The hero image comes from spec open item 4. If Tyler has not supplied photography, ship the hero as a solid
   `--navy` panel with the logo — do **not** substitute a stock photo of unrelated cyclists, and do not block
   this task waiting for the image. Add `<!-- TODO(tyler): hero photograph (spec open item 4) -->` above it.
2. A "Who we are" section: performance-oriented club emphasising racing and training, supporting diverse cyclists through mentoring and development.
3. **Next Rides**, exactly this shape:

```html
<section class="section" aria-labelledby="rides-heading">
  <h2 id="rides-heading">Next rides</h2>
  <div id="next-rides" data-source="static">
    <ul class="rides">
      <li class="ride"><span class="ride__when">Tuesday &amp; Thursday</span><span class="ride__time">5:45 PM</span><span class="ride__title">Weekday group ride</span><span class="ride__place">Bryan Park pool parking lot</span></li>
      <li class="ride"><span class="ride__when">Saturday &amp; Sunday</span><span class="ride__title">Weekend training ride, 40–100+ miles at 18–20 mph</span><span class="ride__place">Sample Gates</span></li>
    </ul>
  </div>
  <p><a class="btn" href="/ride/calendar/">See the full calendar</a></p>
</section>
```

4. Strava club stats:

```html
<section class="section" aria-labelledby="strava-heading">
  <h2 id="strava-heading">On Strava</h2>
  <div class="embed embed--strava">
    <iframe title="Bloomington Velo club on Strava" loading="lazy" allowtransparency frameborder="0" height="160" width="300" scrolling="no"
      src="https://www.strava.com/clubs/329602/latest-rides/ae47281f0af190641e17e6240c59a40c124d670c?show_rides=false"></iframe>
  </div>
</section>
```

5. A join section: GroupMe, `mailto:bloomingtonvelocycling@gmail.com`, and the Instagram link.

- [ ] **Step 4: Wire the module into the page**

Add before `</body>`, after the nav script:

```html
<script type="module" src="/assets/js/rides-init.js"></script>
```

- [ ] **Step 5: Verify the happy path**

Run `npx --yes serve .` with a real key in `config.js` and load `http://localhost:3000/`.
Expected: the container's `data-source` becomes `calendar` and real events render.

If no key is available yet, confirm instead that the console is silent and the static list stays.

- [ ] **Step 6: Verify the three failure paths**

Each must leave the two static rides visible:
1. Set the key to a bogus string → reload → the static list remains, one `console.warn`.
2. Disable JavaScript entirely → reload → the static list remains.
3. Throttle to offline in DevTools → reload → the static list remains.

- [ ] **Step 7: Run the checks**

Run: `node tools/verify.mjs && node --test tests/`
Expected: `0 failing`.

- [ ] **Step 8: Commit**

```bash
git add index.html assets/js/rides-init.js assets/js/config.js
git commit -m "feat: build home page with calendar-backed next rides"
```

---

### Task 8: Ride and Calendar pages

**Files:**
- Create: `ride/index.html`, `ride/calendar/index.html`

**Interfaces:**
- Consumes: `docs/page-template.html`; the `#next-rides` markup contract from Task 7; `rides-init.js`.
- Produces: `/ride/` and `/ride/calendar/`, linked from the nav.

- [ ] **Step 1: Write `ride/index.html`**

Copy the template. Slots:
- `title`: `Group Rides | Bloomington Velo`
- `description`: `Weekday and weekend group rides with Bloomington Velo in Bloomington, Indiana. Times, meeting points, pace expectations, and what to bring.`
- `canonical`: `/ride/`
- Nav: `aria-current="page"` on the Ride link.

Main content:
1. `<h1>Group rides</h1>` and an intro.
2. Weekday rides: Tuesday and Thursday, 5:45 PM, Bryan Park pool parking lot. State the season start and end plainly — use the wording Tyler supplies for open item 5 in the spec; **do not invent dates**. If the wording has not yet been supplied, carry the current site's sentence verbatim and add an HTML comment `<!-- TODO(tyler): confirm ride season wording -->`.
3. Weekend rides: Saturday and Sunday, 40–100+ miles at 18–20 mph, from Sample Gates.
4. What to expect: pace, group etiquette, what to bring, who the rides suit.
5. The same `#next-rides` section as Task 7, copied verbatim including the static fallback.
6. Strava recent rides — identical to Task 7's iframe but with `show_rides=true` and `height="454"`.
7. Links to `/ride/calendar/` and `/team/ride-library/`.
8. `<script type="module" src="/assets/js/rides-init.js"></script>` before `</body>`.

- [ ] **Step 2: Write `ride/calendar/index.html`**

Copy the template. Slots:
- `title`: `Ride Calendar | Bloomington Velo`
- `description`: `The full Bloomington Velo ride and event calendar, including weekday group rides, weekend training rides, and races.`
- `canonical`: `/ride/calendar/`

Main content:

```html
<h1>Ride calendar</h1>
<p>Every club ride, training ride, and event. Times are Eastern.</p>
<div class="embed embed--calendar">
  <iframe title="Bloomington Velo club events calendar" loading="lazy" width="100%" height="600" frameborder="0" scrolling="no"
    src="https://calendar.google.com/calendar/embed?height=600&amp;wkst=1&amp;bgcolor=%23ffffff&amp;ctz=America%2FIndiana%2FIndianapolis&amp;src=cjVsZjNhbDlibG9udGNzam5lZGJyMmYydTBAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ&amp;color=%23132856&amp;title=Bloomington%20Velo%20Club%20Events"></iframe>
</div>
<h2>Add this calendar to your own</h2>
<ul>
  <li><a href="https://calendar.google.com/calendar/u/0?cid=cjVsZjNhbDlibG9udGNzam5lZGJyMmYydTBAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ" target="_blank" rel="noopener noreferrer">Add to Google Calendar</a></li>
  <li><a href="https://calendar.google.com/calendar/ical/r5lf3al9blontcsjnedbr2f2u0%40group.calendar.google.com/public/basic.ics">Subscribe via iCal (Apple Calendar, Outlook)</a></li>
</ul>
```

- [ ] **Step 3: Confirm the iCal feed actually resolves**

Run: `curl -sI "https://calendar.google.com/calendar/ical/r5lf3al9blontcsjnedbr2f2u0%40group.calendar.google.com/public/basic.ics" | head -1`
Expected: `HTTP/2 200`. If it 404s, the calendar is not fully public — remove the iCal link and add it to the open items for Tyler.

- [ ] **Step 4: Verify**

Run: `node tools/verify.mjs`
Expected: `3 file(s) checked, 0 failing`.

- [ ] **Step 5: Visual check**

Serve and load both pages at 390px and 1280px. The calendar iframe must not overflow horizontally on a phone, and the reserved `.embed` height must prevent visible layout shift when it loads.

- [ ] **Step 6: Commit**

```bash
git add ride
git commit -m "feat: add ride and calendar pages"
```

---

### Task 9: Team roster page

The generator runs once; its output is committed as ordinary HTML and hand-maintained from then on.

**Files:**
- Create: `tools/generate-roster-html.mjs`
- Create: `team/index.html`

**Interfaces:**
- Consumes: `_source/roster.json` (Task 2), `assets/img/team/*` (Task 2), `docs/page-template.html` (Task 6).
- Produces: `/team/` containing 34 `<article class="roster-card">` elements.

- [ ] **Step 1: Write `tools/generate-roster-html.mjs`**

```js
#!/usr/bin/env node
// One-time migration helper. Emits roster card markup on stdout for pasting
// into team/index.html. NOT a build step — the HTML is hand-maintained after.
// Usage: node tools/generate-roster-html.mjs > /tmp/roster-cards.html
import { readFileSync } from 'node:fs';

const OFFICERS = {
  'Aaron Prange': 'President',
  'Dave Harstad': 'Vice-President',
  'Matt Ellenwood': 'C.F.O.',
  'Tyler Stambaugh': 'C.T.O.',
  'Kevin Hays': 'Group Ride Coordinator',
};

const roster = JSON.parse(readFileSync('_source/roster.json', 'utf8'));

const cards = roster.map((m) => {
  const name = `${m.first} ${m.last}`.trim();
  const role = OFFICERS[name];
  const photo = m.photo
    ? `    <img class="roster-card__photo" src="${m.photo}" alt="${name}" width="480" height="480" loading="lazy">\n`
    : '';
  const roleLine = role ? `    <p class="roster-card__role">${role}</p>\n` : '';
  const bio = m.bioHtml ? `    <div class="roster-card__bio">${m.bioHtml}</div>\n` : '';
  return `  <article class="roster-card">\n${photo}    <h2 class="roster-card__name">${name}</h2>\n${roleLine}${bio}  </article>`;
});

process.stdout.write(`<div class="card-grid">\n${cards.join('\n')}\n</div>\n`);
```

- [ ] **Step 2: Generate the markup**

```bash
node tools/generate-roster-html.mjs > /tmp/roster-cards.html
grep -c '<article class="roster-card">' /tmp/roster-cards.html
grep -c 'roster-card__photo' /tmp/roster-cards.html
grep -c 'roster-card__bio' /tmp/roster-cards.html
```

Expected: `34`, `13`, `17`. Any other numbers mean stop and re-run Task 2.

- [ ] **Step 3: Write `team/index.html`**

Copy the template. Slots:
- `title`: `Team | Bloomington Velo`
- `description`: `Meet the riders of Bloomington Velo — the racers, trainers, and mentors who make up our cycling club in Bloomington, Indiana.`
- `canonical`: `/team/`

Main content: `<h1>Team</h1>`, an intro paragraph inviting prospective members to get in touch (linking `/contact/`), then the generated card grid pasted in.

Because `roster-card__name` uses `<h2>`, the page keeps exactly one `<h1>`.

- [ ] **Step 4: Convert photos to `<picture>` if WebP was produced in Task 2**

For each card with a photo:

```html
<picture>
  <source srcset="/assets/img/team/NAME.webp" type="image/webp">
  <img class="roster-card__photo" src="/assets/img/team/NAME.jpg" alt="FULL NAME" width="480" height="480" loading="lazy">
</picture>
```

- [ ] **Step 5: Confirm bios were not altered**

```bash
node -e '
const fs=require("fs");
const roster=JSON.parse(fs.readFileSync("_source/roster.json","utf8"));
const page=fs.readFileSync("team/index.html","utf8");
const missing=roster.filter(m=>m.bioHtml && !page.includes(m.bioHtml.trim()));
console.log(missing.length===0 ? "all bios present verbatim" : "ALTERED/MISSING: "+missing.map(m=>m.first+" "+m.last).join(", "));
process.exit(missing.length?1:0);'
```

Expected: `all bios present verbatim`, exit 0.

- [ ] **Step 6: Verify**

Run: `node tools/verify.mjs`
Expected: `4 file(s) checked, 0 failing`.

- [ ] **Step 7: Visual check**

Serve and load `/team/` at 390px, 768px, and 1280px. Cards must reflow to one column on a phone. Cards with no photo and no bio must not look broken next to cards with both.

- [ ] **Step 8: Commit**

```bash
git add tools/generate-roster-html.mjs team/index.html
git commit -m "feat: add team roster page with bios carried over verbatim"
```

---

### Task 10: Route Library page

**Files:**
- Create: `tools/generate-routes-html.mjs`
- Create: `team/ride-library/index.html`

**Interfaces:**
- Consumes: `_source/routes.json` (Task 2), `docs/page-template.html` (Task 6).
- Produces: `/team/ride-library/` containing 4 `<section class="route-group">` elements and 51 route links.

- [ ] **Step 1: Write `tools/generate-routes-html.mjs`**

```js
#!/usr/bin/env node
// One-time migration helper. Emits route list markup on stdout.
// Usage: node tools/generate-routes-html.mjs > /tmp/routes.html
import { readFileSync } from 'node:fs';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const groups = JSON.parse(readFileSync('_source/routes.json', 'utf8'));

const html = groups.map((g) => {
  const id = g.group.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const items = g.routes.map((r) => {
    const desc = r.description ? ` <span class="route__desc">${esc(r.description)}</span>` : '';
    return `      <li class="route"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>${desc}</li>`;
  }).join('\n');
  return `  <section class="route-group" aria-labelledby="g-${id}">\n` +
         `    <h2 id="g-${id}">${esc(g.group)}</h2>\n` +
         `    <ul class="route-list">\n${items}\n    </ul>\n  </section>`;
}).join('\n');

process.stdout.write(html + '\n');
```

- [ ] **Step 2: Generate and count**

```bash
node tools/generate-routes-html.mjs > /tmp/routes.html
grep -c '<section class="route-group"' /tmp/routes.html
grep -c '<li class="route">' /tmp/routes.html
```

Expected: `4` and `51`.

- [ ] **Step 3: Write `team/ride-library/index.html`**

Copy the template. Slots:
- `title`: `Route Library | Bloomington Velo`
- `description`: `51 cycling routes around Bloomington, Indiana, grouped by distance, with Strava and RideWithGPS links for every ride.`
- `canonical`: `/team/ride-library/`

Main content: `<h1>Route library</h1>`, a short intro noting every route links out to Strava or RideWithGPS, then the generated sections.

- [ ] **Step 4: Check every external route link resolves**

```bash
node -e '
const groups=require("./_source/routes.json");
const urls=groups.flatMap(g=>g.routes.map(r=>r.url));
(async()=>{let bad=0;
for(const u of urls){
  try{const r=await fetch(u,{method:"HEAD",redirect:"follow"});
    if(r.status>=400){console.log(r.status,u);bad++;}}
  catch(e){console.log("ERR",u);bad++;}
}
console.log(`${urls.length} checked, ${bad} broken`);})();'
```

Report any broken links to Tyler rather than deleting them; a private Strava route can 401 for an anonymous check while working fine for logged-in members.

- [ ] **Step 5: Verify**

Run: `node tools/verify.mjs`
Expected: `5 file(s) checked, 0 failing`.

- [ ] **Step 6: Commit**

```bash
git add tools/generate-routes-html.mjs team/ride-library/index.html
git commit -m "feat: add route library with all 51 routes"
```

---

### Task 11: Sponsors, Contact, Privacy Policy, and 404

Grouped because each is small, static, and shares one review.

**Files:**
- Create: `sponsors/index.html`, `contact/index.html`, `privacy-policy/index.html`, `404.html`
- Create: `assets/img/sponsors/dumonde-tech.png`

**Interfaces:**
- Consumes: `docs/page-template.html` (Task 6).
- Produces: the final four pages, completing the eight-URL set plus the 404.

- [ ] **Step 1: Download the Dumonde Tech logo**

```bash
mkdir -p assets/img/sponsors
curl -sL "https://bloomingtonvelo.org/sponsors/" | grep -oiE 'wp-content/uploads/[^"]*\.(png|jpg|jpeg|webp)' | sort -u
```

Download the sponsor logo from that list to `assets/img/sponsors/dumonde-tech.png` and note its intrinsic dimensions for the `width`/`height` attributes.

- [ ] **Step 2: Write `sponsors/index.html`**

Slots: title `Sponsors | Bloomington Velo`; description `Bloomington Velo is supported by sponsors who help keep our cycling club rolling. Thank you to Dumonde Tech.`; canonical `/sponsors/`.

Main content: `<h1>Sponsors</h1>`, "Thank you to our wonderful sponsors.", then one repeatable block:

```html
<ul class="card-grid sponsors">
  <li class="sponsor">
    <a href="https://www.dumondetech.com/classic-bicycle-lubricants/" target="_blank" rel="noopener noreferrer">
      <img src="/assets/img/sponsors/dumonde-tech.png" alt="Dumonde Tech" width="WIDTH" height="HEIGHT" loading="lazy">
    </a>
  </li>
</ul>
```

End with a line inviting sponsorship enquiries at the club email. Add an HTML comment above the `<li>`: `<!-- Copy this <li> to add a sponsor. -->`

- [ ] **Step 3: Write `contact/index.html`**

Slots: title `Contact | Bloomington Velo`; description `Get in touch with Bloomington Velo. Contact our officers about joining the club, group rides, or sponsorship in Bloomington, Indiana.`; canonical `/contact/`.

Main content: `<h1>Contact</h1>`, a line inviting prospective members, then a definition list of the five officers — President Aaron Prange, Vice-President Dave Harstad, C.F.O. Matt Ellenwood, C.T.O. Tyler Stambaugh, Group Ride Coordinator Kevin Hays — each name a `mailto:bloomingtonvelocycling@gmail.com` link. Then GroupMe, Strava club, Instagram, and Facebook links.

Add an HTML comment: `<!-- TODO(tyler): confirm officers and roles before launch (spec open item 5) -->`

Include the JSON-LD block:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsClub",
  "name": "Bloomington Velo",
  "url": "https://bloomingtonvelo.org/",
  "logo": "https://bloomingtonvelo.org/assets/img/logo.png",
  "email": "bloomingtonvelocycling@gmail.com",
  "sport": "Cycling",
  "areaServed": { "@type": "City", "name": "Bloomington", "addressRegion": "IN", "addressCountry": "US" },
  "sameAs": [
    "https://www.instagram.com/bloomingtonvelo/",
    "https://www.strava.com/clubs/329602"
  ]
}
</script>
```

Add the Facebook URL to `sameAs` once Tyler confirms it; omit it rather than guessing.

- [ ] **Step 4: Write `privacy-policy/index.html`**

Fetch the current text:

```bash
curl -sL "https://bloomingtonvelo.org/privacy-policy/" -o /tmp/privacy.html
```

Carry the policy body over as clean semantic HTML. Then update the third-party section so it names only what the new site actually loads: Google Calendar (calendar.google.com, googleapis.com) and Strava (strava.com). Remove any reference to Jetpack, WordPress.com, comments, or analytics, none of which exist on the new site.

Slots: title `Privacy Policy | Bloomington Velo`; description `How Bloomington Velo handles visitor information on bloomingtonvelo.org, including the third-party services our website loads.`; canonical `/privacy-policy/`.

- [ ] **Step 5: Write `404.html`**

Slots: title `Page not found | Bloomington Velo`; description `That page does not exist on bloomingtonvelo.org. Head back to the homepage or find our rides, team, and route library.`; canonical `/404.html`.

Main content: `<h1>Page not found</h1>`, a friendly line noting the site was rebuilt in 2026 and some old pages are gone, and links to Home, Ride, Team, and Route Library.

- [ ] **Step 6: Verify**

Run: `node tools/verify.mjs`
Expected: `9 file(s) checked, 0 failing` — the eight pages plus `404.html`.

- [ ] **Step 7: Validate the JSON-LD**

```bash
node -e '
const fs=require("fs");
const m=fs.readFileSync("contact/index.html","utf8").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
JSON.parse(m[1]); console.log("JSON-LD parses");'
```

- [ ] **Step 8: Commit**

```bash
git add sponsors contact privacy-policy 404.html assets/img/sponsors
git commit -m "feat: add sponsors, contact, privacy policy and 404 pages"
```

---

### Task 12: Sitemap, robots, and the site-wide SEO sweep

**Files:**
- Create: `sitemap.xml`, `robots.txt`
- Modify: `index.html` (adds JSON-LD)
- Create: `tests/seo.test.mjs`

**Interfaces:**
- Consumes: all eight pages.
- Produces: `sitemap.xml` listing exactly eight URLs; a test that fails if a page is missing from the sitemap or a title is duplicated.

- [ ] **Step 1: Write the failing test**

Create `tests/seo.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { relative, dirname } from 'node:path';
import { collectHtmlFiles } from '../tools/verify.mjs';

const ROOT = process.cwd();
const pages = collectHtmlFiles(ROOT).filter((f) => !f.endsWith('404.html'));

test('there are exactly eight indexable pages', () => {
  assert.equal(pages.length, 8);
});

test('every page title is unique', () => {
  const titles = pages.map((f) => readFileSync(f, 'utf8').match(/<title>([^<]*)<\/title>/)[1]);
  assert.equal(new Set(titles).size, titles.length, `duplicate titles: ${titles.join(' | ')}`);
});

test('every meta description is unique', () => {
  const ds = pages.map((f) => readFileSync(f, 'utf8').match(/<meta name="description" content="([^"]*)"/)[1]);
  assert.equal(new Set(ds).size, ds.length, `duplicate descriptions: ${ds.join(' | ')}`);
});

test('every page canonical matches its own path', () => {
  for (const f of pages) {
    const expected = '/' + relative(ROOT, dirname(f)).split('\\').join('/').replace(/^$/, '');
    const path = expected === '/' ? '/' : `${expected}/`;
    const canonical = readFileSync(f, 'utf8').match(/<link rel="canonical" href="([^"]*)"/)[1];
    assert.equal(canonical, `https://bloomingtonvelo.org${path}`, `wrong canonical in ${relative(ROOT, f)}`);
  }
});

test('the sitemap lists every indexable page and nothing else', () => {
  const xml = readFileSync('sitemap.xml', 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = pages.map((f) => {
    const rel = relative(ROOT, dirname(f)).split('\\').join('/');
    return rel === '' ? 'https://bloomingtonvelo.org/' : `https://bloomingtonvelo.org/${rel}/`;
  }).sort();
  assert.deepEqual(locs, expected);
});

test('no page references the old WordPress upload paths', () => {
  for (const f of collectHtmlFiles(ROOT)) {
    const html = readFileSync(f, 'utf8');
    assert.ok(!html.includes('wp-content'), `${relative(ROOT, f)} still references wp-content`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/seo.test.mjs`
Expected: FAIL — `sitemap.xml` does not exist.

- [ ] **Step 3: Write `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://bloomingtonvelo.org/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://bloomingtonvelo.org/ride/</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://bloomingtonvelo.org/ride/calendar/</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://bloomingtonvelo.org/team/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://bloomingtonvelo.org/team/ride-library/</loc><changefreq>yearly</changefreq><priority>0.7</priority></url>
  <url><loc>https://bloomingtonvelo.org/sponsors/</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>https://bloomingtonvelo.org/contact/</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>
  <url><loc>https://bloomingtonvelo.org/privacy-policy/</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>
</urlset>
```

- [ ] **Step 4: Write `robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://bloomingtonvelo.org/sitemap.xml
```

- [ ] **Step 5: Add the JSON-LD block to `index.html`**

Paste the same `SportsClub` block used in `contact/index.html` (Task 11, Step 3) into the home page `<head>`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/seo.test.mjs`
Expected: PASS, 6 tests. Fix any duplicate title, description, or canonical it reports.

- [ ] **Step 7: Run everything**

Run: `node --test tests/ && node tools/verify.mjs`
Expected: all pass, `9 file(s) checked, 0 failing`.

- [ ] **Step 8: Commit**

```bash
git add sitemap.xml robots.txt index.html tests/seo.test.mjs
git commit -m "feat: add sitemap, robots and site-wide SEO checks"
```

---

### Task 13: Apache configuration — redirects, headers, caching

**Files:**
- Create: `.htaccess`

**Interfaces:**
- Consumes: `404.html` (Task 11).
- Produces: the deployed server behavior verified in Task 15.

- [ ] **Step 1: Write `.htaccess`**

```apache
# Bloomington Velo — static site. No build step; files are served as committed.

ErrorDocument 404 /404.html
Options -Indexes
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On

  # Force HTTPS and the canonical apex host.
  RewriteCond %{HTTPS} !=on [OR]
  RewriteCond %{HTTP_HOST} ^www\.bloomingtonvelo\.org$ [NC]
  RewriteCond %{HTTP_HOST} !^dev\.bloomingtonvelo\.org$ [NC]
  RewriteRule ^ https://bloomingtonvelo.org%{REQUEST_URI} [R=301,L]

  # Retire the WordPress content that was deliberately removed: 387 news posts
  # at the site root, /photos/, /news/, and WP taxonomy and feed artifacts.
  # Any non-existent extensionless path 301s to the homepage. Requests that
  # look like assets keep their extension, fall through, and hit the 404 page.
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_URI} !\.[a-zA-Z0-9]{2,5}$
  RewriteRule ^ / [R=301,L]
</IfModule>

<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "geolocation=(), microphone=(), camera=(), interest-cohort=()"
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.strava.com https://dgalywyr863hv.cloudfront.net; font-src 'self'; connect-src 'self' https://www.googleapis.com; frame-src https://calendar.google.com https://www.strava.com; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"

  # Staging must never be indexed. Production and staging share this file.
  <If "%{HTTP_HOST} == 'dev.bloomingtonvelo.org'">
    Header always set X-Robots-Tag "noindex, nofollow"
  </If>
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 0 seconds"
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\.html$">
    Header set Cache-Control "max-age=0, must-revalidate"
  </FilesMatch>
  <FilesMatch "\.(css|js|png|jpe?g|webp|woff2|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml text/xml
</IfModule>
```

Two things to watch on Hostinger: `<If>` requires Apache 2.4 (it is), and if `mod_headers` is unavailable the whole block silently no-ops — Task 15 verifies the headers are actually present on staging rather than assuming.

The CSP's `img-src` includes `dgalywyr863hv.cloudfront.net` because the Strava widget serves athlete avatars from there. If the widget renders with broken images on staging, check the console for the blocked host and add it.

- [ ] **Step 2: Confirm no page violates the CSP**

The CSP forbids inline scripts. JSON-LD is `type="application/ld+json"`, which `script-src` does not govern, so it is fine. Confirm there are no other inline scripts:

```bash
grep -rn '<script>' --include=*.html . | grep -v node_modules
grep -rn 'onclick=\|onload=\|onerror=' --include=*.html . | grep -v node_modules
```

Expected: no output from either. If anything appears, move it into a file under `assets/js/`.

- [ ] **Step 3: Confirm every stylesheet and script is same-origin**

```bash
grep -rhoE '(src|href)="https?://[^"]*"' --include=*.html . \
  | grep -vE 'bloomingtonvelo\.org|calendar\.google\.com|www\.strava\.com|instagram\.com|dumondetech\.com|ridewithgps\.com|facebook\.com|groupme\.com' \
  | sort -u
```

Expected: no output. Anything listed is either a CSP violation waiting to happen or an unwanted third-party dependency.

- [ ] **Step 4: Verify**

Run: `node --test tests/ && node tools/verify.mjs`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add .htaccess
git commit -m "feat: add Apache config for redirects, CSP, caching and staging noindex"
```

---

### Task 14: Performance and accessibility audit

**Files:**
- Modify: whichever pages the audit finds wanting.
- Create: `docs/audit-2026-08.md`

**Interfaces:**
- Consumes: the complete site.
- Produces: recorded Lighthouse scores of 95+ on all four categories for all eight pages, and a per-page asset weight table.

- [ ] **Step 1: Measure first-party page weight**

```bash
node -e '
const fs=require("fs"),path=require("path");
const pages=["index.html","team/index.html","team/ride-library/index.html","ride/index.html","ride/calendar/index.html","sponsors/index.html","contact/index.html","privacy-policy/index.html"];
const size=f=>{try{return fs.statSync(f).size}catch{return 0}};
const shared=size("assets/css/site.css")+size("assets/js/nav.js");
for(const p of pages){
  const html=fs.readFileSync(p,"utf8");
  const imgs=[...html.matchAll(/(?:src|srcset)="(\/assets\/[^"\s]+)"/g)]
    .map(m=>size("."+m[1])).reduce((a,b)=>a+b,0);
  const js=/rides-init/.test(html)?size("assets/js/rides.js")+size("assets/js/rides-init.js")+size("assets/js/config.js"):0;
  const total=size(p)+shared+imgs+js;
  console.log(`${(total/1024).toFixed(1).padStart(7)} KB  ${p}${total>102400?"  <-- OVER BUDGET":""}`);
}'
```

Expected: every page under 100 KB. `/team/` is the likeliest to exceed it because of 13 photos — if it does, drop the photo `resize` width to 320 and re-run the WebP conversion from Task 2 Step 6.

- [ ] **Step 2: Run Lighthouse on every page**

```bash
npx --yes serve . &
for p in "" team/ team/ride-library/ ride/ ride/calendar/ sponsors/ contact/ privacy-policy/; do
  npx --yes lighthouse "http://localhost:3000/$p" \
    --preset=desktop --quiet --chrome-flags="--headless" \
    --output=json --output-path="/tmp/lh-$(echo "${p:-home}" | tr '/' '-').json"
done
```

Then again without `--preset=desktop` for mobile. Extract the four category scores from each JSON.

Note Lighthouse will flag the missing `.htaccess` headers on localhost — `npx serve` does not read Apache config. Those specific findings are expected locally and get verified for real in Task 15.

- [ ] **Step 3: Fix anything below 95 and re-measure**

Likely findings and their fixes:
- Missing `width`/`height` on an image → add them (the verifier should already catch this).
- Contrast failure on muted text → darken `--muted` until it passes 4.5:1.
- Render-blocking CSS → the stylesheet is small and same-origin; leave it, do not inline.

- [ ] **Step 4: Validate every page against the W3C Nu validator**

```bash
for f in index.html team/index.html team/ride-library/index.html ride/index.html \
         ride/calendar/index.html sponsors/index.html contact/index.html \
         privacy-policy/index.html 404.html; do
  echo "== $f"
  curl -s -H "Content-Type: text/html; charset=utf-8" \
    --data-binary "@$f" "https://validator.w3.org/nu/?out=json" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        const m=JSON.parse(s).messages.filter(x=>x.type==="error");
        console.log(m.length?m.map(x=>`  line ${x.lastLine}: ${x.message}`).join("\n"):"  clean");});'
done
```

Expected: `clean` for all nine. Fix every error.

- [ ] **Step 5: Manual accessibility pass**

For every page:
- Tab through end to end. Focus must always be visible and the order must follow the visual order.
- The skip link must be the first stop and must move focus into `<main>`.
- At 390px the mobile nav must open, close, trap nothing, and close on Escape.
- Zoom the browser to 200%. No horizontal scrolling, no clipped text.
- Confirm every image's `alt` describes the image, and decorative images use `alt=""`.

- [ ] **Step 6: Record the results**

Write `docs/audit-2026-08.md` with a table of page × (perf, a11y, best practices, SEO) for mobile and desktop, the page-weight table from Step 1, and a list of anything knowingly left unfixed with the reason.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "perf: fix audit findings and record baseline scores"
```

---

### Task 15: Publish to GitHub and deploy to staging

**Files:**
- Modify: `assets/js/config.js` (real API key)
- Create: `docs/deploy.md`

**Interfaces:**
- Consumes: the complete verified site.
- Produces: a public GitHub repo under the `bloomingtonvelo` org and a working `dev.bloomingtonvelo.org`.

- [ ] **Step 1: Tyler creates the GitHub organization**

`gh` cannot create organizations. Tyler creates `bloomingtonvelo` at https://github.com/organizations/plan, choosing the free plan.

**Blocked until this is done.**

- [ ] **Step 2: Create the repo and push**

```bash
gh repo create bloomingtonvelo/bloomingtonvelo --public \
  --description "Static website for Bloomington Velo cycling club" \
  --source=. --remote=origin --push
gh repo view bloomingtonvelo/bloomingtonvelo --web
```

- [ ] **Step 3: Protect `main`**

```bash
gh api -X PUT repos/bloomingtonvelo/bloomingtonvelo/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f "required_pull_request_reviews[required_approving_review_count]=0" \
  -F "enforce_admins=false" \
  -F "required_status_checks=null" \
  -F "restrictions=null" \
  -F "allow_force_pushes=false"
gh api repos/bloomingtonvelo/bloomingtonvelo/branches/main/protection | head -20
```

- [ ] **Step 4: Tyler creates the Google Calendar API key**

In Google Cloud Console, on an account that can administer the club's Google presence:
1. Create a project named `bloomington-velo-site`.
2. Enable the **Google Calendar API**.
3. Credentials → Create credentials → API key.
4. Restrict the key: Application restrictions → HTTP referrers → add `https://bloomingtonvelo.org/*` and `https://dev.bloomingtonvelo.org/*`. API restrictions → restrict to **Google Calendar API**.
5. Confirm the club calendar's sharing is "Make available to public".

Paste the key into `assets/js/config.js`, replacing `REPLACE_WITH_RESTRICTED_KEY`.

- [ ] **Step 5: Confirm the key works against the real calendar**

```bash
KEY=$(node -e 'import("./assets/js/config.js").then(m=>console.log(m.GOOGLE_CALENDAR_API_KEY))')
CAL="r5lf3al9blontcsjnedbr2f2u0%40group.calendar.google.com"
curl -s "https://www.googleapis.com/calendar/v3/calendars/$CAL/events?key=$KEY&maxResults=3&singleEvents=true&orderBy=startTime&timeMin=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);
      if(j.error){console.error("FAIL",j.error.message);process.exit(1);}
      console.log(`ok: ${j.items.length} upcoming event(s)`);j.items.forEach(i=>console.log(" -",i.summary));});'
```

Expected: `ok: N upcoming event(s)`. A referrer-restricted key returns 403 to curl in some configurations — if so, verify in a browser on staging in Step 8 instead.

Commit the key: `git add assets/js/config.js && git commit -m "chore: add restricted Google Calendar API key" && git push`

- [ ] **Step 6: Tyler creates the staging subdomain**

hPanel → Domains → Subdomains → create `dev`, giving `dev.bloomingtonvelo.org`. Note the document root it creates.

- [ ] **Step 7: Configure Hostinger Git deploy for staging**

hPanel → Websites → Advanced → Git:
- Repository: `https://github.com/bloomingtonvelo/bloomingtonvelo.git`
- Branch: `main`
- Directory: the staging subdomain's document root
- Deploy, then enable auto-deployment and copy the webhook URL into GitHub → repo Settings → Webhooks → Add webhook (content type `application/json`, event: just the push event).

- [ ] **Step 8: Verify staging end to end**

```bash
for p in "" team/ team/ride-library/ ride/ ride/calendar/ sponsors/ contact/ privacy-policy/; do
  printf "%-24s %s\n" "/$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://dev.bloomingtonvelo.org/$p")"
done
echo "--- headers ---"
curl -sI "https://dev.bloomingtonvelo.org/" | grep -iE 'x-robots-tag|content-security-policy|x-content-type-options|cache-control'
echo "--- dead url redirect ---"
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' "https://dev.bloomingtonvelo.org/off-season-recovery/"
echo "--- 404 ---"
curl -s -o /dev/null -w '%{http_code}\n' "https://dev.bloomingtonvelo.org/assets/img/nope.png"
```

Expected: eight `200`s; `X-Robots-Tag: noindex, nofollow` present; the CSP and nosniff headers present; the dead URL returning `301 -> https://dev.bloomingtonvelo.org/`; the missing asset returning `404`.

Then in a browser on staging: the Next Rides list must show real calendar events, the Strava widget must render, and no CSP violations may appear in the console.

- [ ] **Step 9: Officer review**

Send the staging URL to the club officers. Collect feedback, fix it, push. Confirm the site on at least one iPhone and one Android device.

**STOP HERE.** Do not proceed to Task 16 without Tyler's explicit go-ahead.

- [ ] **Step 10: Write `docs/deploy.md`**

Record the exact hPanel settings used, the webhook URL location, how to roll back, and how to rotate the API key.

- [ ] **Step 11: Commit**

```bash
git add docs/deploy.md
git commit -m "docs: record deployment configuration"
git push
```

---

### Task 16: Production cutover

**Files:** none changed. This task is configuration and verification.

**Interfaces:**
- Consumes: an approved staging site.
- Produces: the new site live at bloomingtonvelo.org.

- [ ] **Step 1: Tyler takes a full WordPress backup**

hPanel → Files → Backups → generate and **download** a full backup, both files and database. Confirm the download completed and note where it is stored.

**Do not proceed without a downloaded backup in hand.**

- [ ] **Step 2: Record the current search baseline**

In Google Search Console, note the current impressions, clicks, and indexed page count for the property. This is the "before" number the post-launch monitoring compares against.

- [ ] **Step 3: Clear `public_html` and point the Git deploy at it**

hPanel → Websites → Advanced → Git: change the production deployment directory to `public_html`, or add a second repository entry targeting it. Deploy manually the first time, then enable auto-deployment and register the webhook as in Task 15 Step 7.

The WordPress files must be removed from `public_html` so that a stale `wp-config.php` or the WordPress `.htaccess` cannot shadow the new one.

- [ ] **Step 4: Verify production**

Run the same block as Task 15 Step 8 against `https://bloomingtonvelo.org/`, with one difference: `X-Robots-Tag` must now be **absent**.

```bash
for p in "" team/ team/ride-library/ ride/ ride/calendar/ sponsors/ contact/ privacy-policy/; do
  printf "%-24s %s\n" "/$p" "$(curl -s -o /dev/null -w '%{http_code}' "https://bloomingtonvelo.org/$p")"
done
curl -sI "https://bloomingtonvelo.org/" | grep -i 'x-robots-tag' && echo "PROBLEM: production is noindexed" || echo "ok: not noindexed"
curl -s -o /dev/null -w 'www redirect: %{http_code} -> %{redirect_url}\n' "https://www.bloomingtonvelo.org/"
curl -s -o /dev/null -w 'http redirect: %{http_code} -> %{redirect_url}\n' "http://bloomingtonvelo.org/"
```

- [ ] **Step 5: Spot-check ten retired URLs**

```bash
for u in off-season-recovery tuesday-night-tt-results-5112016 2022-candy-stripe-classic \
         candy-stripe-classic-bicycle-race-march-10-11-2018 news photos sponsors/../photos \
         category/news tag/racing author/admin; do
  printf "%-52s %s\n" "/$u/" "$(curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}' "https://bloomingtonvelo.org/$u/")"
done
```

Expected: `301 -> https://bloomingtonvelo.org/` for each. Note that `/sponsors/` itself must still return `200` — confirm it separately, since it is a live page and must not be caught by the catch-all.

- [ ] **Step 6: Browser verification on production**

- Next Rides shows real events (the API key's referrer restriction now matters — this is the first time the production origin is used).
- Strava widget renders on Home and Ride.
- Google Calendar iframe renders on the Calendar page.
- No console errors, no CSP violations.
- Check on a phone over cellular, not wifi.

- [ ] **Step 7: Submit to Search Console**

- Submit `https://bloomingtonvelo.org/sitemap.xml`.
- Use URL Inspection → Request Indexing on all eight pages.
- Remove the old `sitemap_index.xml` submission.

- [ ] **Step 8: Tag the launch**

```bash
git tag -a v1.0.0 -m "Static site launch, replacing WordPress"
git push origin v1.0.0
```

- [ ] **Step 9: Schedule the follow-up**

Set a reminder for four weeks out to review Search Console coverage, the 404 and soft-404 reports, and Core Web Vitals against the Step 2 baseline. Record the outcome in `docs/audit-2026-08.md`.

---

## Post-launch notes

- WordPress can be uninstalled from Hostinger once the site has been stable for a few weeks and the backup is safely stored. Do not rush this.
- `_source/roster.json` and `_source/routes.json` are a historical record of what was migrated. They are not read at runtime. Keep them.
- `tools/extract-content.mjs`, `tools/generate-roster-html.mjs`, and `tools/generate-routes-html.mjs` are one-time migration helpers. They will stop working when the WordPress site is removed, which is fine and expected.
- `tools/verify.mjs` and `tests/` remain useful forever. Run both before every push.
