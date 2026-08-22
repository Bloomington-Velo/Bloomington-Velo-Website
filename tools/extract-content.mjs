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
    .replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“').replace(/&#8221;/g, '”')
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

// Only strava.com / ridewithgps.com links are real routes. The live "30 – 44
// Miles" section also contains one stray internal wp-admin edit-page link
// (a leftover authoring mistake, not a route) — excluded by this filter.
const ROUTE_HOSTS = /^https?:\/\/(www\.)?(strava\.com|ridewithgps\.com)\//;

export function parseRoutes(html) {
  const headings = [...html.matchAll(/<h2 id="at-\d+"[^>]*>([\s\S]*?)<\/h2>/g)];
  const chunks = html.split(/<h2 id="at-\d+"[^>]*>[\s\S]*?<\/h2>/).slice(1);
  return headings.map((h, i) => {
    // Bound each group's body to its own accordion content: stop at the
    // first "</div></div>" (closing the accordion content div and its item
    // wrapper) so trailing page content (widgets, social links) isn't
    // mistaken for routes. In the test fixture this marker is absent, so
    // the whole (already heading-bounded) chunk is used unchanged.
    let body = chunks[i] ?? '';
    const closeIdx = body.indexOf('</div></div>');
    if (closeIdx !== -1) body = body.slice(0, closeIdx);
    // Routes are rendered either as one <a> per <li>, or (on the live site)
    // as a run of <a>...</a> &#8211; description<br> pairs inside a single
    // <p>. Both shapes are just "an anchor, then text up to the next
    // anchor", so match generically rather than requiring <li>.
    const routes = [...body.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+href=|$)/g)]
      .flatMap(([, url, nameHtml, afterHtml]) => {
        if (!ROUTE_HOSTS.test(url)) return [];
        const name = decodeEntities(nameHtml.replace(/<[^>]*>/g, ''));
        const description = decodeEntities(afterHtml.replace(/<[^>]*>/g, ''))
          .replace(/^[–—-]\s*/, '').trim();
        return [{ name, url, description }];
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
