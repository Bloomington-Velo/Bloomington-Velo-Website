# Bloomington Velo

The source for [bloomingtonvelo.org](https://bloomingtonvelo.org). This is a
hand-written static site: plain HTML, CSS, and JavaScript, no framework and
**no build step**. Whatever is committed to the repository is exactly what
Apache serves — there is no compile, bundle, or transform step between a
commit and the live site.

## Local preview

Because the site uses root-absolute paths (`/assets/...`) and some pages use
`fetch`, opening a file directly in the browser (`file://...`) will not work
correctly. Serve the repo over a real local origin instead:

```
npx --yes serve .
```

Then open `http://localhost:3000` in a browser.

## Verify

Two checks should be run before committing any change:

```
node tools/verify.mjs
node --test
```

`tools/verify.mjs` performs offline structural checks against every HTML
file in the repo (doctype, lang, meta tags, canonical URL, exactly one
`<h1>`, image `alt`/dimensions, iframe `title`/`loading="lazy"`, external
links using `rel="noopener"`, and internal link targets). It exits non-zero
if any page fails. `node --test` runs the unit tests for the verifier
itself.

## Adding a page

1. Copy `docs/page-template.html` (created in Task 5) to the new page's
   directory as `index.html`.
2. Fill in every `<!-- SLOT: ... -->` marker in the copy.
3. Add the new URL to `sitemap.xml`.
4. Add a nav link to the new page on all 8 existing pages.
5. Run `node tools/verify.mjs` and fix anything it reports.

## Adding a roster member

1. Copy an existing `<article class="roster-card">` block in
   `team/index.html`.
2. Fill in the copied block with the new rider's details.
3. Add the rider's photo to `assets/img/team/`.

## Adding a sponsor

1. Copy the sponsor block in `sponsors/index.html`.
2. Fill in the copied block with the new sponsor's details and logo.

## Deploy

Push to `main`. Hostinger pulls from the repository automatically — there is
nothing to build or upload manually.

## Google Calendar API key

The Google Calendar API key used to embed the club calendar is stored in
Hostinger's environment/site configuration, not in this repository. To
rotate it, generate a new key in the Google Cloud Console for the project
backing the calendar embed, update the value in Hostinger, and confirm the
`/ride/calendar/` page still loads events.
