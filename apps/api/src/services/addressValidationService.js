import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../logging/logger.js';

const VALIDATION_URL = 'https://addressvalidation.googleapis.com/v1:validateAddress';

export async function validateAddress({ addressLine1, addressLine2, city, state, zip }) {
  const apiKey = config.googleMaps.addressValidationApiKey;
  if (!apiKey) {
    // No provider configured — accept the address as entered (dev/test fallback).
    logger.info('address_validation_dev_fallback', { city, state, zip });
    return { valid: true, formattedAddress: null, unconfirmedComponentTypes: [] };
  }

  const addressLines = [addressLine1, addressLine2].filter(Boolean);

  let res;
  try {
    res = await fetch(`${VALIDATION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: {
          regionCode: 'US',
          addressLines,
          locality: city,
          administrativeArea: state,
          postalCode: zip,
        },
      }),
    });
  } catch (err) {
    logger.error('address_validation_request_failed', { message: err.message });
    throw new AppError('Address verification service is unavailable. Please try again.', 502, 'ADDRESS_VALIDATION_UNAVAILABLE');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error('address_validation_api_error', { status: res.status, body });
    throw new AppError('Address verification service is unavailable. Please try again.', 502, 'ADDRESS_VALIDATION_UNAVAILABLE');
  }

  const data = await res.json();
  const verdict = data.result?.verdict ?? {};
  const address = data.result?.address ?? {};

  const valid = !!verdict.addressComplete && !verdict.hasUnconfirmedComponents;

  return {
    valid,
    formattedAddress: address.formattedAddress ?? null,
    unconfirmedComponentTypes: address.unconfirmedComponentTypes ?? [],
  };
}
