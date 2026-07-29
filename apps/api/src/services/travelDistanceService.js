import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../logging/logger.js';

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

// Fallback used when a caller (or the stored travel settings) doesn't specify a
// limit. The owner-configurable value lives in travel_settings.max_drive_minutes.
export const DEFAULT_MAX_DRIVE_MINUTES = 20;

// Distance Matrix only applies traffic_model when given a concrete departure_time.
// Use the next weekday at 5:00 PM as a stand-in for "peak traffic".
export function nextPeakDepartureTimestamp() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(17, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
  return Math.floor(target.getTime() / 1000);
}

export async function isWithinServiceArea({ originAddress, destinationAddress, maxDriveMinutes = DEFAULT_MAX_DRIVE_MINUTES }) {
  const apiKey = config.googleMaps.distanceMatrixApiKey;
  if (!apiKey) {
    // No provider configured — accept the address as entered (dev/test fallback).
    logger.info('travel_distance_dev_fallback', { destinationAddress });
    return { withinRange: true, driveMinutes: null };
  }

  const params = new URLSearchParams({
    origins: originAddress,
    destinations: destinationAddress,
    departure_time: String(nextPeakDepartureTimestamp()),
    traffic_model: 'pessimistic',
    key: apiKey,
  });

  let res;
  try {
    res = await fetch(`${DISTANCE_MATRIX_URL}?${params}`);
  } catch (err) {
    logger.error('travel_distance_request_failed', { message: err.message });
    throw new AppError('Service area check is unavailable. Please try again.', 502, 'TRAVEL_DISTANCE_UNAVAILABLE');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error('travel_distance_api_error', { status: res.status, body });
    throw new AppError('Service area check is unavailable. Please try again.', 502, 'TRAVEL_DISTANCE_UNAVAILABLE');
  }

  const data = await res.json();
  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new AppError("We couldn't determine a drive time to this address.", 422, 'TRAVEL_DISTANCE_UNRESOLVED');
  }

  const seconds = element.duration_in_traffic?.value ?? element.duration.value;
  const driveMinutes = seconds / 60;

  return { withinRange: driveMinutes <= maxDriveMinutes, driveMinutes };
}
