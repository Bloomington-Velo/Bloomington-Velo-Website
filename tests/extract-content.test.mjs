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
