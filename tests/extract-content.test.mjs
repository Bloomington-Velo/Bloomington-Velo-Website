import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster, parseRoutes, assertBalancedBios } from '../tools/extract-content.mjs';

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

// Real bios (e.g. Blayne Roeder's) are a run of sibling <div>s inside
// tmm_desc — dated achievements, a fundraising line, an embedded photo. A
// lazy `<div ...>([\s\S]*?)<\/div>` regex stops at the FIRST </div> and
// silently drops everything after it, which is exactly the bug this guards.
const NESTED_BIO_HTML = `
<div class="tmm_container"><div class="tmm_member">
<div class="tmm_textblock"><div class="tmm_names"><span class="tmm_fname">Blayne</span> <span class="tmm_lname">Roeder</span></div>
<div class="tmm_desc" style="text-align:"><div>June 21, 2020 - Everesting Basecamp</div><div>Raised $500 for charity</div><div><img src="https://example.com/photo.jpg" /></div></div>
</div></div></div>`;

test('parseRoster captures the full bio across sibling <div>s, including the last child', () => {
  const [m] = parseRoster(NESTED_BIO_HTML);
  assert.equal(
    m.bioHtml,
    '<div>June 21, 2020 - Everesting Basecamp</div><div>Raised $500 for charity</div><div><img src="https://example.com/photo.jpg" /></div>',
  );
});

test('assertBalancedBios throws, naming the member, when a bio has unbalanced <div> tags', () => {
  const brokenRoster = [
    { first: 'Blayne', last: 'Roeder', bioHtml: '<div>June 21, 2020 - Alp du Zwift Everesting Basecamp (15,020ft)' },
  ];
  assert.throws(() => assertBalancedBios(brokenRoster), /Unbalanced <div> tags in bio for Blayne Roeder/);
});

test('assertBalancedBios does not throw for balanced or null bios', () => {
  assert.doesNotThrow(() => assertBalancedBios([
    { first: 'A', last: 'B', bioHtml: '<div>ok</div>' },
    { first: 'C', last: 'D', bioHtml: null },
  ]));
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

// The live ride-library page does NOT use <ul><li> — each group is a single
// <p class="wp-block-paragraph"> with <a> links separated by <br>, wrapped
// in an accordion (<h2>...<div id="ac-...">...content...</div></div>). This
// fixture matches that real shape and also includes: a non-route host link
// (a leaked wp-admin edit URL, same as the live "30 – 44 Miles" section) and
// a link placed AFTER the accordion's closing "</div></div>" sentinel, which
// must not be attributed to the preceding group.
const PROD_ROUTES_HTML = `
<h2 id="at-93970" class="c-accordion__title js-accordion-controller" role="button">Team Favorites</h2><div id="ac-93970" class="c-accordion__content">
<p class="wp-block-paragraph"><a href="https://www.strava.com/routes/24665993" target="_blank" rel="external noopener noreferrer" data-wpel-link="external">Oliver TT</a> &#8211; A nice flat Time Trial<br><a href="https://bloomingtonvelo.org/wp-admin/post.php?post=285&amp;action=edit" target="_blank" rel="noreferrer noopener" data-wpel-link="internal">Tour Du Frontage</a> &#8211; Should be excluded<br><a href="https://www.strava.com/routes/2738014567283918702" target="_blank" rel="noreferrer noopener external" data-wpel-link="external">Isaac&#8217;s West is Best</a> &#8211; North-West side Climb Bonanza</p>
</div></div>
<div class="wp-block-column"><a href="https://www.strava.com/routes/999999">Should Not Count</a> &#8211; after the section boundary</div>
`;

test('parseRoutes reads routes from real <p>/<br>-separated production markup', () => {
  const [group] = parseRoutes(PROD_ROUTES_HTML);
  assert.equal(group.group, 'Team Favorites');
  assert.deepEqual(group.routes[0], {
    name: 'Oliver TT',
    url: 'https://www.strava.com/routes/24665993',
    description: 'A nice flat Time Trial',
  });
  assert.deepEqual(group.routes[1], {
    name: 'Isaac’s West is Best',
    url: 'https://www.strava.com/routes/2738014567283918702',
    description: 'North-West side Climb Bonanza',
  });
});

test('parseRoutes excludes a link to a non-allowed host (e.g. a wp-admin edit URL)', () => {
  const [group] = parseRoutes(PROD_ROUTES_HTML);
  assert.ok(!group.routes.some((r) => r.name === 'Tour Du Frontage'));
  assert.equal(group.routes.length, 2);
});

test('parseRoutes does not attribute a link past the section-closing sentinel to that group', () => {
  const [group] = parseRoutes(PROD_ROUTES_HTML);
  assert.ok(!group.routes.some((r) => r.name === 'Should Not Count'));
});
