import { config } from '../config/index.js';
import { logger } from '../logging/logger.js';
import {
  DEFAULT_MAX_DRIVE_MINUTES,
  nextPeakDepartureTimestamp,
} from './travelDistanceService.js';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

// Straight-line kilometres a car can plausibly cover per minute of driving.
// Deliberately generous so the sample grid over-reaches along highway
// corridors; the Distance Matrix drive-time check trims anything truly too far.
const KM_PER_MINUTE = 1.2;

// Sample points are laid out as concentric rings around the origin. Distance
// Matrix allows up to 25 destinations per request, so keep the total ≤ 25:
// 8 bearings × 3 rings + the origin itself.
const RING_FRACTIONS = [0.4, 0.7, 1.0];
const BEARING_COUNT = 8;

const EARTH_RADIUS_KM = 6371;

// When no Distance Matrix key is configured (dev/test), fall back to a curated
// list so the UI still renders. Mirrors the production shape (town names only).
export const DEV_FALLBACK_TOWNS = [
  'Belmont', 'Boston', 'Brookline', 'Cambridge', 'Chestnut Hill', 'Dedham',
  'Needham', 'Newton', 'Somerville', 'Waltham', 'Watertown', 'Wellesley',
  'West Roxbury', 'Weston',
];

// Fingerprint of the inputs that determine the town list. When this changes
// (owner edits the address or the drive-time limit) the cache is stale.
export function serviceAreaSignature({ originAddress, maxDriveMinutes }) {
  const normalizedAddress = String(originAddress ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return `${normalizedAddress}|${maxDriveMinutes}`;
}

// Project a point `distanceKm` away from `origin` along `bearingDeg`.
function offsetPoint(origin, distanceKm, bearingDeg) {
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const angular = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function buildSampleGrid(origin, maxDriveMinutes) {
  const maxRadiusKm = maxDriveMinutes * KM_PER_MINUTE;
  const points = [origin];
  for (const fraction of RING_FRACTIONS) {
    for (let i = 0; i < BEARING_COUNT; i++) {
      points.push(offsetPoint(origin, maxRadiusKm * fraction, (360 / BEARING_COUNT) * i));
    }
  }
  return points;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Maps request failed with status ${res.status}`);
  }
  return res.json();
}

async function geocode(address, apiKey) {
  const params = new URLSearchParams({ address, key: apiKey });
  const data = await fetchJson(`${GEOCODE_URL}?${params}`);
  const location = data.results?.[0]?.geometry?.location;
  if (!location) {
    throw new Error(`Could not geocode origin address: ${data.status}`);
  }
  return { lat: location.lat, lng: location.lng };
}

// Keep only the sample points reachable within the drive-time limit.
async function filterReachable(originAddress, points, maxDriveMinutes, apiKey) {
  const destinations = points.map(p => `${p.lat},${p.lng}`).join('|');
  const params = new URLSearchParams({
    origins: originAddress,
    destinations,
    departure_time: String(nextPeakDepartureTimestamp()),
    traffic_model: 'pessimistic',
    key: apiKey,
  });
  const data = await fetchJson(`${DISTANCE_MATRIX_URL}?${params}`);
  const elements = data.rows?.[0]?.elements ?? [];
  const limitSeconds = maxDriveMinutes * 60;

  return points.filter((_, i) => {
    const element = elements[i];
    if (!element || element.status !== 'OK') return false;
    const seconds = element.duration_in_traffic?.value ?? element.duration?.value;
    return typeof seconds === 'number' && seconds <= limitSeconds;
  });
}

function extractTown(result) {
  const components = result?.address_components ?? [];
  // Prefer an incorporated town/city; fall back through progressively coarser
  // administrative levels so we still name something for every reachable point.
  const preferredTypes = ['locality', 'postal_town', 'sublocality', 'administrative_area_level_3'];
  for (const type of preferredTypes) {
    const match = components.find(c => c.types.includes(type));
    if (match) return match.long_name;
  }
  return null;
}

async function reverseGeocodeTowns(points, apiKey) {
  const results = await Promise.all(
    points.map(async p => {
      const params = new URLSearchParams({ latlng: `${p.lat},${p.lng}`, key: apiKey });
      try {
        const data = await fetchJson(`${GEOCODE_URL}?${params}`);
        for (const result of data.results ?? []) {
          const town = extractTown(result);
          if (town) return town;
        }
      } catch (err) {
        logger.warn('service_area_reverse_geocode_failed', { message: err.message });
      }
      return null;
    })
  );
  return results.filter(Boolean);
}

// Approach 1: sample a grid of points around the origin, keep the ones within
// the drive-time limit, resolve each to a town name, and return the sorted
// unique set. Returns DEV_FALLBACK_TOWNS when no API key is configured.
export async function computeServiceAreaTowns({ originAddress, maxDriveMinutes }) {
  const apiKey = config.googleMaps.distanceMatrixApiKey;
  if (!apiKey) {
    logger.info('service_area_dev_fallback', { originAddress, maxDriveMinutes });
    return DEV_FALLBACK_TOWNS;
  }

  const origin = await geocode(originAddress, apiKey);
  const grid = buildSampleGrid(origin, maxDriveMinutes);
  const reachable = await filterReachable(originAddress, grid, maxDriveMinutes, apiKey);
  const towns = await reverseGeocodeTowns(reachable, apiKey);

  return [...new Set(towns)].sort((a, b) => a.localeCompare(b));
}

// Returns the cached town list, recomputing (and persisting) only when the
// origin address or max_drive_minutes have changed since it was last computed.
export async function resolveServiceAreaTowns(businessRepo) {
  const settings = await businessRepo.getTravelSettings();
  const maxDriveMinutes = settings?.max_drive_minutes ?? DEFAULT_MAX_DRIVE_MINUTES;
  const contact = await businessRepo.getBusinessContactInfo();

  if (!contact?.address_line1) {
    return { towns: [], maxDriveMinutes };
  }

  const originAddress = `${contact.address_line1}, ${contact.city}, ${contact.state} ${contact.zip}`;
  const signature = serviceAreaSignature({ originAddress, maxDriveMinutes });

  if (settings?.service_area_signature === signature && Array.isArray(settings.service_area_towns)) {
    return { towns: settings.service_area_towns, maxDriveMinutes };
  }

  let towns;
  try {
    towns = await computeServiceAreaTowns({ originAddress, maxDriveMinutes });
  } catch (err) {
    logger.error('service_area_compute_failed', { message: err.message });
    // Serve a stale cache if we have one; otherwise the dev fallback. Don't
    // persist — leave the signature stale so the next request retries.
    if (Array.isArray(settings?.service_area_towns)) {
      return { towns: settings.service_area_towns, maxDriveMinutes };
    }
    return { towns: DEV_FALLBACK_TOWNS, maxDriveMinutes };
  }

  await businessRepo.saveServiceAreaTowns({ towns, signature });
  return { towns, maxDriveMinutes };
}
