#!/usr/bin/env node
// One-time migration helper. Emits route library markup on stdout for pasting
// into ride/routes/index.html. NOT a build step — the HTML is hand-maintained
// after this runs once.
//
// Usage: node tools/generate-routes-html.mjs > routes.html
import { readFileSync } from 'node:fs';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const groups = JSON.parse(readFileSync(new URL('../_source/routes.json', import.meta.url), 'utf8'));

const html = groups.map((g) => {
  const id = slugify(g.group);
  const items = g.routes.map((r) => {
    const desc = r.description ? ` <span class="route__desc">${esc(r.description)}</span>` : '';
    return `      <li class="route"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>${desc}</li>`;
  }).join('\n');
  return `  <section class="route-group" id="${id}" aria-labelledby="${id}-heading">\n` +
         `    <h2 id="${id}-heading">${esc(g.group)}</h2>\n` +
         `    <ul class="route-list">\n${items}\n    </ul>\n  </section>`;
}).join('\n');

process.stdout.write(html + '\n');
