// Marketing attribution: capture UTM parameters from incoming links and persist
// first-touch (permanent, localStorage) and last-touch (per-session, sessionStorage)
// so a booking can be attributed to the channel that drove it.
//
// First-touch answers "where did this person originally discover us?" and is written
// once. Last-touch answers "what brought them back to actually book?" and is overwritten
// whenever a new UTM-tagged link is followed within the session.

const FIRST_TOUCH_KEY = 'atlas_first_touch';
const LAST_TOUCH_KEY = 'atlas_last_touch';

// All storage access is guarded — private mode / disabled storage must not break booking.
function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// Parse the standard channel-defining UTM fields from a query string. Returns null when
// none are present (direct / organic traffic), so we never overwrite touches on plain navigation.
function parseUtm(search) {
  const params = new URLSearchParams(search || '');
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (!source && !medium && !campaign) return null;
  return {
    source: source || null,
    medium: medium || null,
    campaign: campaign || null,
    capturedAt: new Date().toISOString(),
  };
}

// Call on initial load and on every route change. Records first-touch once and refreshes
// last-touch whenever a UTM-tagged link is followed.
export function captureFromUrl(search) {
  const utm = parseUtm(search);
  if (!utm) return;
  if (!readJson(localStorage, FIRST_TOUCH_KEY)) {
    writeJson(localStorage, FIRST_TOUCH_KEY, utm);
  }
  writeJson(sessionStorage, LAST_TOUCH_KEY, utm);
}

// Flat fields ready to spread into the create-appointment payload. Last-touch falls back
// to first-touch so a single-visit booking still carries attribution on both.
export function getAttribution() {
  const first = readJson(localStorage, FIRST_TOUCH_KEY);
  const last = readJson(sessionStorage, LAST_TOUCH_KEY) || first;
  return {
    firstUtmSource: first?.source ?? undefined,
    firstUtmMedium: first?.medium ?? undefined,
    firstUtmCampaign: first?.campaign ?? undefined,
    lastUtmSource: last?.source ?? undefined,
    lastUtmMedium: last?.medium ?? undefined,
    lastUtmCampaign: last?.campaign ?? undefined,
  };
}
