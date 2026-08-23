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
