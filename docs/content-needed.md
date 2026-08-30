# Content needed from the club

Every item below is a placeholder or an open question in the rebuilt site. Each one names the file it
affects and what happens if it ships unanswered, so nothing gets lost between here and launch.

Placeholders are marked in the source with `<!-- TODO(tyler): ... -->` so they can be found with:

```bash
grep -rn "TODO(tyler)" --include=*.html --include=*.mjs .
```

Status legend: **RESOLVED** — decided, no action · **DEGRADED** — ships and works, but noticeably
worse · **COSMETIC** — minor.

Nothing on this list blocks launch. Three items are now closed: the ride-season wording and the
officer roster both carry over from the live site verbatim, and the photography gap is filled by the
club's own Sample Gates photograph, which now backs both the homepage hero and the social card.

---

## 1. Photography — RESOLVED (club photography supplied)

**Decision (site owner):** use `IMG_0399.jpg` from the club's own archive — the group gathered at the
Indiana University Sample Gates, with the arch and the clock tower behind them.
**Where:** the homepage hero, and `assets/img/og-default.jpg` (the social sharing card).
**Final content:** the hero ships the photograph as a `<picture>` with WebP and JPEG derivatives at
800/1200/1600/2400px (`assets/img/hero-*.{jpg,webp}`), eager and `fetchpriority="high"`, under a navy
scrim tuned so the headline and lede keep AA contrast against the picture. The social card is built on
the same frame by `tools/make-og-image.mjs`, which is still re-runnable and now takes the photograph
from the committed `assets/img/hero-2400.jpg` rather than the gitignored original, so it works for
anyone with the repository.
**Still welcome, not blocking:** more photography would let later pages carry their own imagery.
`/ride/`, `/team/` and `/sponsors/` currently reuse this single frame or carry no image at all. Landscape,
daylight, faces and bikes, 2400px wide or more, and not too busy at the edges where text sits.
**Note:** both scrims are tuned to *this* photograph's pixels, not generically. If the hero image is
ever swapped, re-measure the text contrast rather than assuming it still passes — the measurement is
recorded in the Task 6 report and is reproducible.

## 2. Weekday ride season wording — RESOLVED, keep as-is

**Decision (site owner):** carry the live site's wording over verbatim. No change, no placeholder.
**Where:** `/ride/`, and the static fallback schedule inside the `#next-rides` block on `/` and `/ride/`.
**Text:** Tuesday and Thursday rides leave Bryan Park pool parking lot at 5:45 PM "until daylight
savings time"; weekend rides 40–100+ miles at 18–20 mph from Sample Gates.
**Noted for the record:** "until daylight savings time" can be read as either the start or the end of
DST. The club is keeping the phrasing it has always used, and members evidently understand it. Nothing
to action — recorded only so a future maintainer does not re-raise it as a defect.

## 3. Officers and their contact addresses — RESOLVED, keep as-is

**Decision (site owner):** the roster and the shared mailbox both carry over unchanged.
**Where:** `/contact/`.
**Final content:** President Aaron Prange, Vice-President Dave Harstad, C.F.O. Matt Ellenwood,
C.T.O. Tyler Stambaugh, Group Ride Coordinator Kevin Hays — every one linking to
`bloomingtonvelocycling@gmail.com`. No individual addresses.

## 4. Roster currency — DEGRADED

**Where:** `/team/` — 34 members, 17 with bios, 13 with photos.
**Current placeholder:** the roster exactly as it stands on the live WordPress site, which appears to
date from around 2021. All bios carried over verbatim, unedited.
**What's needed:** who has joined and who has left. New members' names, and optionally a bio and photo
in the same shape as the existing entries.
**If unanswered:** the new site launches with a stale roster — the most visible "this site isn't
maintained" signal a club site can send.

## 5. "Brain Drummy" — COSMETIC, but it is someone's name

**Where:** `/team/`, and `_source/roster.json`.
**Current state:** the WordPress source literally contains `<span class="tmm_fname">Brain</span>`, and
the constraint to carry roster content over verbatim means it was migrated as-is. His photo file is
named `Brian-Drummy-Photo.jpg`, so the intended spelling is almost certainly Brian.
**What's needed:** confirmation to correct it.
**If unanswered:** a member's first name stays misspelled on the team page, as it already is today.

## 6. "Tour Du Frontage" route link — COSMETIC

**Where:** `/ride/routes/`, the "30 – 44 Miles" group.
**Current state:** on the live site this route links to
`https://bloomingtonvelo.org/wp-admin/post.php?post=285&action=edit` — a WordPress admin edit URL that
already fails for any visitor who is not logged in. It was excluded from the migration, so the new
Route Library has 51 routes where the old page displays 52.
**What's needed:** the real Strava or RideWithGPS URL, or confirmation to drop the route.
**If unanswered:** one route silently disappears — which is still an improvement on a link that 403s.
**Note:** restoring it changes that group's count from 9 to 10, which the extractor asserts. The
assertion in `tools/extract-content.mjs` must be updated in the same change.

## 7. GroupMe join link — DEGRADED

**Where:** `/contact/`, and the join call-to-action on `/`.
**Current placeholder:** GroupMe is named as the way to join, with no link — same as the live site.
**What's needed:** the GroupMe join URL.
**If unanswered:** the primary "how do I actually join" path is a dead end; prospective members have to
email and wait.

## 8. Facebook page URL — COSMETIC

**Where:** site footer, and the `sameAs` array in the `SportsClub` structured data on `/` and `/contact/`.
**Current state:** omitted rather than guessed. Instagram and Strava are both present and confirmed.
**What's needed:** the club's Facebook page URL, if one is active.
**If unanswered:** one fewer verified profile for search engines to associate with the club. Minor SEO
loss, no functional impact.

## 9. Sponsors — COSMETIC

**Where:** `/sponsors/`.
**Current state:** Dumonde Tech only, matching the live site, with the markup structured so another
sponsor is a copy-paste of one block.
**What's needed:** any additional sponsors, with logo files and destination URLs.
**If unanswered:** the page carries one sponsor, exactly as today.

---

## Launch prerequisites — not content, but only the club can do them

These gate Tasks 15 and 16 and are deliberately held back from automated execution, because they
publish to the world or are hard to reverse.

| | |
|---|---|
| GitHub organization | Create `bloomingtonvelo` at github.com/organizations/plan (free tier). `gh` cannot create orgs. |
| Google Calendar API key | Google Cloud project → enable Calendar API → create an API key → restrict it to the Calendar API and to referrers `bloomingtonvelo.org/*` and `dev.bloomingtonvelo.org/*`. Goes in `assets/js/config.js`. |
| Calendar visibility | Confirm the club calendar's sharing is set to "Make available to public". |
| Staging subdomain | Create `dev.bloomingtonvelo.org` in Hostinger hPanel. |
| WordPress backup | A full, **downloaded** files-and-database backup before `public_html` is swapped. |
