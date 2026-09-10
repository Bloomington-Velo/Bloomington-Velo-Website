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

## 6. Route library link rot — CHECKED 2026-09-03

**Where:** `/ride/routes/`.

**Four of the 51 route links return 404:**

| Route | Group | URL |
|---|---|---|
| (Not Williams) Ride | 45 – 64 Miles | `strava.com/routes/2719230454939750190` |
| Kerr, Brummetts Creek, 45, South shore, Robinson | 45 – 64 Miles | `strava.com/routes/2711585649669942028` |
| 45, Tunnel, Shilo, Old 37, Chambers, Bottom | 45 – 64 Miles | `strava.com/routes/2709058117370675384` |
| Dolan, E'ville, Airport & beyond | 45 – 64 Miles | `strava.com/routes/2714122208184638124` |

**Worth knowing before you delete them:** a Strava route also returns 404 to anonymous visitors when
its owner has made it **private**. These may not be deleted at all — a member could restore them by
changing the route's visibility. Ask before removing.

**Two pairs of routes share one URL**, so two names point at the same ride:
- `strava.com/routes/2769791863478727940` — "Stanford-Hobbieville-" and "Springville"
- `strava.com/routes/2759630324309341696` — "Buttered" and "Popcorn"

**Also:** "Tour Du Frontage" existed on the old site linking to a WordPress admin edit URL, which
already failed for any visitor. It was excluded from the migration, so the new library has 51 routes
where the old page showed 52. Supply a real URL to restore it.

**Everything else resolves:** the other 47 routes, Instagram, the Strava club, Dumonde Tech, and both
calendar subscribe links all return 200.

**Note:** none of this is a regression — the same links are equally dead on the current site. The
rebuild just made it visible. Fixing any of it is editing one line in `ride/routes/index.html`.

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
| Google Calendar API key | **Not in Hostinger** — console.cloud.google.com, signed in as the calendar owner. New project → APIs & Services → Library → enable **Google Calendar API** → Credentials → Create credentials → API key. Then Edit the key and restrict it twice: Application restrictions → Websites → `https://bloomingtonvelo.org/*` and `https://dev.bloomingtonvelo.org/*`; API restrictions → Google Calendar API only. Goes in `assets/js/config.js`, committed. Public by design — the restrictions are what make it safe, and it can only read an already-public calendar. |
| ~~Calendar visibility~~ | **DONE** — verified 2026-08-30: the public ICS feed returns 200 with 562 events, so the calendar is already public. No action needed. |
| Staging subdomain | Create `dev.bloomingtonvelo.org` in Hostinger hPanel. |
| WordPress backup | A full, **downloaded** files-and-database backup before `public_html` is swapped. |
