// Pure logic for the "Next Rides" agenda. No DOM access — see rides-init.js.
export const CALENDAR_ID = 'r5lf3al9blontcsjnedbr2f2u0@group.calendar.google.com';
export const TIME_ZONE = 'America/Indiana/Indianapolis';

const API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export function buildEventsUrl({ apiKey, now = new Date(), maxResults = 8 }) {
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: now.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });
  return `${API_BASE}/${encodeURIComponent(CALENDAR_ID)}/events?${params}`;
}

export function parseEvents(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .filter((item) => item?.status !== 'cancelled' && (item?.start?.dateTime || item?.start?.date))
    .map((item) => {
      const allDay = !item.start.dateTime;
      const iso = item.start.dateTime ?? `${item.start.date}T12:00:00Z`;
      const start = new Date(iso);
      return {
        id: item.id ?? iso,
        title: (item.summary ?? '').trim() || 'Club ride',
        location: (item.location ?? '').trim(),
        start: Number.isNaN(start.getTime()) ? null : start,
        allDay,
      };
    })
    .filter((e) => e.start !== null);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAgenda(events, { timeZone = TIME_ZONE } = {}) {
  if (!events.length) return '';
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'short', day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit',
  });

  const items = events.map((event) => {
    const when = dayFmt.format(event.start);
    const time = event.allDay ? '' : `<span class="ride__time">${escapeHtml(timeFmt.format(event.start))}</span>`;
    const place = event.location
      ? `<span class="ride__place">${escapeHtml(event.location)}</span>` : '';
    return `<li class="ride">` +
      `<time class="ride__when" datetime="${event.start.toISOString()}">${escapeHtml(when)}</time>` +
      time +
      `<span class="ride__title">${escapeHtml(event.title)}</span>` +
      place +
      `</li>`;
  });

  return `<ul class="rides">${items.join('')}</ul>`;
}
