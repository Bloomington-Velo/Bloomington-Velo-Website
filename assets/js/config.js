// Public API key, restricted in Google Cloud to the Calendar API and to the
// HTTP referrers bloomingtonvelo.org/* and dev.bloomingtonvelo.org/*. It is
// safe to commit: the referrer restriction is what protects it, not secrecy.
// The real key arrives in Task 15; until then the placeholder below is
// deliberate and rides-init.js treats it as "no key configured", falling
// back to the static schedule. Rotating it: see README.
export const GOOGLE_CALENDAR_API_KEY = 'REPLACE_WITH_RESTRICTED_KEY';
