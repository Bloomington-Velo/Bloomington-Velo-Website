# bloomingtonvelo.org — Static Rebuild Design

**Date:** 2026-08-22
**Author:** Tyler Stambaugh (Bloomington Velo, C.T.O.) with Claude
**Status:** Approved — ready for implementation planning

## 1. Purpose

Replace the WordPress site at bloomingtonvelo.org with a hand-written static site of HTML, CSS, and vanilla JavaScript. The rebuild must be fast, mobile-friendly, search-optimized, and maintainable by a volunteer club officer without a build toolchain or a content management system.

### Goals

- No framework, no build step, no npm dependencies at runtime or build time.
- Responsive down to 320px, tested on real phones.
- Preserve the live Google Calendar and Strava club integrations.
- Preserve the team roster and the 51-route Route Library.
- Equal or better SEO than the current Yoast-managed WordPress site.
- Deploy by pushing to `main`.

### Non-goals

- No blog or news publishing capability.
- No contact form, no server-side code, no database.
- No CMS or admin interface. Content changes are edits to HTML files.
- No rebrand. The existing navy identity and BV logo carry over.

## 2. Current state

| Aspect | Current |
|---|---|
| Platform | WordPress, `twentytwentyone-child` theme by David Martin Design |
| Plugins | `team-members`, `ics-calendar`, `accordion-blocks`, Jetpack, Yoast SEO |
| Pages | Home, Team, Ride, Ride/Calendar, Team/Ride-Library, Photos, News, Sponsors, Contact, Privacy Policy |
| Posts | 387 news posts, 2007–2022, dormant |
| Calendar | Google Calendar iframe, calendar ID `r5lf3al9blontcsjnedbr2f2u0@group.calendar.google.com`, public |
| Strava | Official Strava club widget, club 329602, token `ae47281f0af190641e17e6240c59a40c124d670c` |
| Roster | 34 members (`tmm_member` markup), 17 with bios, 13 with photos |
| Contact | Five officers, all mailto `bloomingtonvelocycling@gmail.com`. No form. |
| Sponsors | Dumonde Tech only |
| Brand | Navy `#132856`, square BV logo (`BV-2020-Logo-Square-Compressed.png`) |

## 3. Scope decisions

| Decision | Choice | Rationale |
|---|---|---|
| 387 news posts | Dropped entirely | Dormant since 2022, thin content, no residual value worth the maintenance |
| Photos page | Dropped; Instagram CTA instead | Instagram is where the club is actually active |
| Sponsors page | Kept | Dumonde Tech is a real sponsor; more expected later |
| Contact form | None; mailto links only | Matches current behavior; zero dependencies, zero spam |
| Roster content | Scraped verbatim, no editorial trimming | Nobody's bio gets shortened without their consent |
| Roster rendering | Hand-written HTML cards | No build step, perfect SEO, changes are rare |
| Calendar | Vanilla-JS agenda + full-month iframe | On-brand and fast on the common path, grid still available |
| Strava | Official club widget iframe, copied verbatim | Off-the-shelf, no API or token maintenance |
| Partials | Duplicated header/footer in each page | At 8 pages, duplication is cheaper than the machinery to avoid it |
| Repo | Public, `bloomingtonvelo` GitHub org, protected `main` | Free, simple deploy, survives officer turnover |
| Deploy | Hostinger built-in Git auto-deploy | No credentials in GitHub, no CI, fits a no-build repo |
| Cutover | localhost → staging subdomain → swap `public_html` | Officer review on real devices before launch |
| Redirects | Identical page URLs + catch-all 301 | No ranking transfer risk on pages that matter |

## 4. Site structure

Eight pages. Every URL is byte-identical to the current live URL, so no page that currently ranks requires a redirect.

```
bloomingtonvelo/
├── index.html                     → /
├── team/index.html                → /team/
├── ride/
│   ├── index.html                 → /ride/
│   ├── calendar/index.html        → /ride/calendar/
│   └── routes/index.html          → /ride/routes/
├── sponsors/index.html            → /sponsors/
├── contact/index.html             → /contact/
├── privacy-policy/index.html      → /privacy-policy/
├── 404.html
├── assets/
│   ├── css/site.css
│   ├── js/rides.js
│   ├── js/nav.js
│   ├── fonts/
│   └── img/
├── .htaccess
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── README.md
```

The Route Library moves from its current `/team/ride-library/` to `/ride/routes/`, where it belongs alongside the other riding pages. This is the one URL that changes, so it gets an explicit 301 (see §8) rather than relying on the catch-all.

**Navigation:** Team · Ride (Calendar, Route Library) · Sponsors · Contact

## 5. Page specifications

### 5.1 Home (`/`)

- Hero: photograph, club name, one-line positioning, primary CTA ("Ride with us").
- Who we are: performance-oriented club, racing and training emphasis, mentoring and development of diverse cyclists.
- **Next Rides**: JS-rendered agenda of the next up-to-8 calendar events (§6).
- Strava club widget, `show_rides=false` (stats only).
- Instagram CTA and join instructions (GroupMe, club email).
- Primary SEO target: *Bloomington Indiana cycling club*.

### 5.2 Ride (`/ride/`)

- Weekly schedule: Tuesday and Thursday 5:45 PM from Bryan Park pool parking lot, early March through the end of daylight saving time. Weekend rides 40–100+ miles at 18–20 mph from Sample Gates.
- Pace expectations, group ride etiquette, what to bring, who the rides suit.
- Next Rides agenda (same component as Home).
- Strava club widget, `show_rides=true` (recent rides).
- Links to `/ride/calendar/` and `/ride/routes/`.

### 5.3 Calendar (`/ride/calendar/`)

- Full-month Google Calendar iframe, `loading="lazy"`, `title` attribute set, responsive wrapper.
- "Add this calendar to your own" links (Google, iCal/ICS).

### 5.4 Route Library (`/ride/routes/`)

- All 51 routes in the four existing groups: Team Favorites (3), 30–44 Miles (9), 45–64 Miles (31), 65+ Miles (8).
- Per route: name linked to Strava or RideWithGPS, plus its one-line description.
- External links carry `rel="noopener noreferrer"` and open in a new tab.
- Static markup. No filtering or search.

### 5.5 Team (`/team/`)

- Intro paragraph inviting prospective members to make contact.
- 34 roster cards (17 have bios, 13 have photos). Bios verbatim from the current site. Consistent card markup so the layout is uniform even where content length is not.
- Fields per member, all optional except name: name, role (officer titles flagged), photo, bio, residence, education, occupation.
- Cards use a CSS grid that reflows to a single column on narrow screens.

### 5.6 Sponsors (`/sponsors/`)

- "Thank you to our wonderful sponsors."
- Dumonde Tech: logo linked to `https://www.dumondetech.com/classic-bicycle-lubricants/`.
- Markup structured so additional sponsors are a copy-paste of one block.
- A short note on how to inquire about sponsoring, pointing at the club email.

### 5.7 Contact (`/contact/`)

- Five officers with roles and mailto links: President Aaron Prange, Vice-President Dave Harstad, C.F.O. Matt Ellenwood, C.T.O. Tyler Stambaugh, Group Ride Coordinator Kevin Hays. All currently resolve to `bloomingtonvelocycling@gmail.com`. **Verify this list is current before launch.**
- Club email, GroupMe, Strava club, Instagram, Facebook.
- No form.

### 5.8 Privacy Policy (`/privacy-policy/`)

- Existing policy text carried over. Reviewed for accuracy against the new site's actual third parties: Google Calendar, Strava.

### 5.9 404 (`/404.html`)

- Branded, apologetic, links into the main nav and to the homepage.
- In practice this serves missing assets; extensionless dead paths are caught by the redirect rule in §8.

## 6. Google Calendar integration

### Request

```
GET https://www.googleapis.com/calendar/v3/calendars/
    r5lf3al9blontcsjnedbr2f2u0%40group.calendar.google.com/events
    ?key=<API_KEY>
    &timeMin=<ISO8601 now>
    &singleEvents=true
    &orderBy=startTime
    &maxResults=8
```

The calendar is public, so the endpoint is CORS-enabled and needs no OAuth.

### API key

- Created in a Google Cloud project owned by the club account.
- Restricted to the **Google Calendar API** only.
- Restricted by **HTTP referrer** to `bloomingtonvelo.org/*` and `dev.bloomingtonvelo.org/*`.

The key is visible in page source by design. The referrer and API restrictions are what make that acceptable; the key grants read access to an already-public calendar and nothing else.

### Rendering

- Each event renders as: day of week, date, start time, title, location.
- Times formatted in `America/Indiana/Indianapolis` via `Intl.DateTimeFormat`.
- All-day events render without a time.
- Successful responses cached in `sessionStorage` (key includes the date) so navigating between Home and Ride does not refetch.

### Progressive enhancement — required behavior

The HTML ships with the recurring weekly schedule as real, readable text inside the Next Rides container. JavaScript **replaces** that content only on a successful fetch. If JS is disabled, the API key is rejected, the network fails, or the response is empty, the visitor sees the static schedule plus a link to the full calendar. There is never a spinner-only state and never an empty box.

## 7. SEO

- Unique `<title>` and `<meta name="description">` per page.
- Exactly one `<h1>` per page; semantic `header`/`nav`/`main`/`footer` landmarks.
- `<link rel="canonical">` on every page, absolute HTTPS URL.
- Open Graph and Twitter Card tags with a 1200×630 OG image.
- JSON-LD `SportsClub` on Home and Contact: name, logo, `areaServed` Bloomington IN, email, `sameAs` for Instagram, Facebook, and Strava.
- Hand-maintained `sitemap.xml` listing the 8 URLs, and `robots.txt` pointing to it.
- Descriptive `alt` text on every image; descriptive link text (no "click here").
- URL parity means no ranking transfer risk on the pages that matter.

Yoast previously handled the mechanical parts of this. The README carries an "adding a page" checklist covering title, description, canonical, OG tags, sitemap entry, and nav link, to replace what Yoast used to nag about.

**Post-launch:** submit the new sitemap in Google Search Console and monitor the 404 and soft-404 reports for four weeks.

## 8. Redirects, headers, and `.htaccess`

### Redirect strategy

One URL changes: the Route Library moves to `/ride/routes/`. It gets an explicit 301 that must be
evaluated **before** the catch-all, or the catch-all would send it to the homepage instead:

```apache
RewriteRule ^team/ride-library/?$ /ride/routes/ [R=301,L]
```

Every other page sits at its existing URL, so no further page redirect is needed. Dead URLs — 387 news posts at the site root, `/photos/`, `/news/`, and WordPress artifacts like `/category/`, `/tag/`, `/author/`, `/feed/` — are handled by one rule:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !\.[a-zA-Z0-9]{2,5}$
RewriteRule ^ / [R=301,L]
```

Any non-existent extensionless path 301s to the homepage. Requests for missing assets keep their extension, fall through, and get the custom 404.

**Known tradeoff:** Google may classify a few hundred redirects-to-homepage as soft 404s. That is acceptable — we are not trying to retain rankings for content we deliberately removed.

### Staging noindex

Production and staging share one `.htaccess`, so staging is protected by host:

```apache
<If "%{HTTP_HOST} == 'dev.bloomingtonvelo.org'">
  Header set X-Robots-Tag "noindex, nofollow"
</If>
```

### Other `.htaccess` contents

- `ErrorDocument 404 /404.html`
- Cache headers: `assets/` immutable for 1 year, HTML `max-age=0, must-revalidate`
- Compression for text assets
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, and a Content-Security-Policy allowing `frame-src https://calendar.google.com https://www.strava.com` and `connect-src 'self' https://www.googleapis.com`
- Force HTTPS and canonical host

## 9. Performance and accessibility

### Budget

- Keep first-party assets per page (HTML + CSS + JS + images) as small as is reasonable. This is a guideline to design against, not a hard gate: report page weight in the audit, flag anything that looks bloated, but do not contort the markup or degrade image quality to hit a number.
- Google Calendar and Strava iframes are `loading="lazy"` and never block first paint. This is the largest single improvement over the current site, which loads Jetpack, jQuery, and four plugins on every page.
- One self-hosted variable font with `font-display: swap`. No Google Fonts request.
- Responsive images with `srcset` and `sizes`; WebP with JPEG fallback; explicit `width` and `height` on every image to prevent layout shift.
- Target Lighthouse **95+** on Performance, Accessibility, Best Practices, and SEO, verified per page before launch.

### Accessibility

- Skip-to-content link.
- Visible focus indicators throughout.
- Mobile nav toggle with `aria-expanded` and `aria-controls`, operable by keyboard, closing on Escape.
- WCAG AA contrast against the navy palette.
- `prefers-reduced-motion` respected for any transition.
- Iframes carry descriptive `title` attributes.

## 10. Design system

The visual direction is chosen in Phase 1 from two or three static homepage mockups (see §12). Whatever wins, the system underneath is:

- CSS custom properties for color, spacing, and type scale, defined once on `:root`.
- Navy `#132856` as the brand anchor; the existing BV logo unchanged.
- Mobile-first, fluid layouts using CSS Grid and Flexbox with `clamp()` typography.
- A single `assets/css/site.css`. No preprocessor.
- Components: header/nav, hero, section, card (roster, sponsor), ride agenda item, route list, footer.

## 11. Local development and deployment

### Local

`npx --yes serve .` — Node 22 is already installed. A local HTTP server is required rather than `file://`, because `fetch` and root-absolute paths need a real origin.

### Staging

- `dev.bloomingtonvelo.org` subdomain created in Hostinger hPanel.
- Second Git deploy target on the same repo.
- Noindexed by the host-conditional rule in §8.

### Production

- hPanel → Websites → Git: repo URL, branch `main`, deploy path `public_html`.
- Auto-deployment webhook URL registered in the GitHub repo's webhook settings.
- Push to `main` deploys.

### Repository governance

- Public repo in a `bloomingtonvelo` GitHub organization.
- Tyler as Owner; other officers added as members with per-repo roles.
- `main` protected: require a pull request, block force-pushes.

### Rollback

Full WordPress backup taken before the swap. Reverting is a `git revert` plus redeploy, or restoring the WordPress backup.

## 12. Implementation phases

| Phase | Work |
|---|---|
| 0 | GitHub org and repo, scaffold, `.htaccess` skeleton, README |
| 1 | Design spike: 2–3 static homepage mockups for side-by-side comparison; pick one |
| 2 | Design system: CSS custom properties, type scale, header/nav/footer components |
| 3 | Home: hero, Next Rides, Strava widget |
| 4 | Ride and Calendar pages |
| 5 | Team roster, bios verbatim |
| 6 | Route Library, 51 routes |
| 7 | Sponsors, Contact, Privacy Policy, 404 |
| 8 | SEO pass: meta, JSON-LD, sitemap, robots, OG image |
| 9 | Redirects, caching, security headers, Lighthouse and validation pass |
| 10 | Staging deploy, officer review on real devices |
| 11 | WordPress backup, production swap, Search Console |

## 13. Verification

There is no unit-test framework for a static site. Verification is explicit and runs before the staging deploy and again before the production swap:

- **HTML validity**: every page through the W3C Nu validator; zero errors.
- **Lighthouse**: every page, mobile profile; 95+ on all four categories.
- **Links**: automated crawl of every internal and external link; zero broken.
- **Calendar fallback**: verified with JS disabled and with a deliberately invalid API key — the static schedule must render in both cases.
- **Responsive**: 320px, 768px, 1280px, plus at least one real phone.
- **Keyboard**: full traversal of every page including the mobile nav.
- **Redirects**: a sample of ~10 dead news URLs confirmed returning 301 to `/`.

## 14. Open items requiring Tyler

1. Create the `bloomingtonvelo` GitHub organization.
2. Create the Google Calendar API key with API and referrer restrictions.
3. Confirm the club calendar's sharing is set to public.
4. **Supply photography.** The hero image is the difference between a site that recruits and one that merely informs, and the current site has very little usable imagery. This is the largest content risk in the project.
5. Confirm the five officers and their roles are current, and confirm the ride schedule wording. The current site says weekday rides run "until daylight savings time," which is ambiguous — the new copy should state the actual start and end of the weekday ride season.
6. Create the `dev.bloomingtonvelo.org` subdomain in hPanel before Phase 10.
7. Take a full WordPress backup before Phase 11.
