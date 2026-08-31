#!/usr/bin/env node
// One-time migration helper. Emits roster card markup on stdout for pasting
// into team/index.html. NOT a build step — the HTML is hand-maintained after
// this runs once. bioHtml is emitted byte-for-byte from _source/roster.json;
// it is never reformatted, re-tagged, or truncated.
//
// Usage: node tools/generate-roster-html.mjs > roster-cards.html
import { readFileSync } from 'node:fs';

const OFFICERS = {
  'Aaron Prange': 'President',
  'Dave Harstad': 'Vice-President',
  'Matt Ellenwood': 'C.F.O.',
  'Tyler Stambaugh': 'C.T.O.',
  'Kevin Hays': 'Group Ride Coordinator',
};

// Intrinsic pixel dimensions of the source JPEG/JPEG-alike for each photo,
// read once with a JPEG SOF-marker parser and hardcoded here so this script
// has no runtime dependency on the image files existing at generation time.
// Keyed by the filename stem shared by the .jpg/.jpeg and .webp siblings.
const PHOTO_DIMENSIONS = {
  'teallen': [225, 339],
  'john-boshears-strava': [124, 124],
  'maartenbout': [225, 338],
  'brauner': [225, 338],
  'Brian-Drummy-Photo': [1333, 2000],
  'dharstad': [225, 338],
  'khays': [225, 339],
  'steve-holbrook': [640, 532],
  'Jim-Kirkham-Photo-scaled': [1600, 2133],
  'tluck': [225, 338],
  'JOEL-MCKAY-PHOTO-scaled': [1600, 2062],
  'aaron-prange-e1610241033590': [780, 808],
  'blayne-roeder-profile-compressed': [1600, 1741],
};

const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const roster = JSON.parse(readFileSync(new URL('../_source/roster.json', import.meta.url), 'utf8'));

const cards = roster.map((m) => {
  const name = `${m.first} ${m.last}`.trim();
  const role = OFFICERS[name];

  let photoBlock = '';
  if (m.photo) {
    const dot = m.photo.lastIndexOf('.');
    const stem = m.photo.slice(0, dot);
    const jpgPath = m.photo;
    const webpPath = `${stem}.webp`;
    const fileStem = stem.slice(stem.lastIndexOf('/') + 1);
    const dims = PHOTO_DIMENSIONS[fileStem];
    if (!dims) throw new Error(`no known dimensions for photo stem "${fileStem}" (${name})`);
    const [width, height] = dims;
    const alt = escapeAttr(name);
    photoBlock =
      `    <picture>\n` +
      `      <source srcset="${webpPath}" type="image/webp">\n` +
      `      <img class="roster-card__photo" src="${jpgPath}" alt="${alt}" width="${width}" height="${height}" loading="lazy">\n` +
      `    </picture>\n`;
  }

  const roleLine = role ? `    <p class="roster-card__role">${role}</p>\n` : '';
  const bio = m.bioHtml ? `    <div class="roster-card__bio">${m.bioHtml}</div>\n` : '';
  const nameHtml = escapeAttr(name);

  return (
    `  <article class="roster-card">\n` +
    photoBlock +
    `    <h3 class="roster-card__name">${nameHtml}</h3>\n` +
    roleLine +
    bio +
    `  </article>`
  );
});

process.stdout.write(`<div class="roster-grid">\n${cards.join('\n')}\n</div>\n`);
