import { buildEventsUrl, parseEvents, renderAgenda } from './rides.js';
import { GOOGLE_CALENDAR_API_KEY } from './config.js';

const CACHE_KEY = `bv-rides-${new Date().toISOString().slice(0, 10)}`;

async function loadEvents() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const res = await fetch(buildEventsUrl({ apiKey: GOOGLE_CALENDAR_API_KEY }));
  if (!res.ok) throw new Error(`calendar ${res.status}`);
  const payload = await res.json();
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  return payload;
}

async function init() {
  const container = document.getElementById('next-rides');
  if (!container || GOOGLE_CALENDAR_API_KEY.startsWith('REPLACE_')) return;

  try {
    const html = renderAgenda(parseEvents(await loadEvents()));
    if (html) {
      container.innerHTML = html;
      container.dataset.source = 'calendar';
    }
  } catch (err) {
    // Leave the static fallback in place. Never blank the container.
    console.warn('Next Rides: falling back to the static schedule.', err);
  }
}

init();
