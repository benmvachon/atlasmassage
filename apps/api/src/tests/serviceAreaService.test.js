import { jest } from '@jest/globals';

const mockConfig = {
  googleMaps: { distanceMatrixApiKey: '' },
};

await jest.unstable_mockModule('../config/index.js', () => ({ config: mockConfig }));

await jest.unstable_mockModule('../logging/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  serviceAreaSignature,
  computeServiceAreaTowns,
  resolveServiceAreaTowns,
  DEV_FALLBACK_TOWNS,
} = await import('../services/serviceAreaService.js');

const CONTACT = {
  address_line1: '101 Bellevue Street', city: 'Newton', state: 'MA', zip: '02458',
};
const ORIGIN = '101 Bellevue Street, Newton, MA 02458';

function makeRepo(settings) {
  return {
    getTravelSettings: jest.fn().mockResolvedValue(settings),
    getBusinessContactInfo: jest.fn().mockResolvedValue(CONTACT),
    saveServiceAreaTowns: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.googleMaps.distanceMatrixApiKey = '';
});

describe('serviceAreaSignature', () => {
  it('is stable across whitespace/case differences in the address', () => {
    const a = serviceAreaSignature({ originAddress: '101 Bellevue Street, Newton, MA 02458', maxDriveMinutes: 20 });
    const b = serviceAreaSignature({ originAddress: '  101   Bellevue Street,  NEWTON, ma 02458 ', maxDriveMinutes: 20 });
    expect(a).toBe(b);
  });

  it('changes when max drive minutes changes', () => {
    const a = serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 20 });
    const b = serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 30 });
    expect(a).not.toBe(b);
  });
});

describe('computeServiceAreaTowns', () => {
  it('returns the dev fallback list when no API key is configured', async () => {
    const towns = await computeServiceAreaTowns({ originAddress: ORIGIN, maxDriveMinutes: 20 });
    expect(towns).toEqual(DEV_FALLBACK_TOWNS);
  });
});

describe('resolveServiceAreaTowns', () => {
  it('returns the cached towns when the signature matches', async () => {
    const signature = serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 20 });
    const repo = makeRepo({
      max_drive_minutes: 20,
      service_area_signature: signature,
      service_area_towns: ['Cached Town'],
    });

    const result = await resolveServiceAreaTowns(repo);

    expect(result).toEqual({ towns: ['Cached Town'], maxDriveMinutes: 20 });
    expect(repo.saveServiceAreaTowns).not.toHaveBeenCalled();
  });

  it('recomputes and persists when the signature is stale', async () => {
    const repo = makeRepo({
      max_drive_minutes: 20,
      service_area_signature: 'stale',
      service_area_towns: ['Old Town'],
    });

    const result = await resolveServiceAreaTowns(repo);

    // No API key → compute falls back to the dev list, which is then persisted.
    expect(result.towns).toEqual(DEV_FALLBACK_TOWNS);
    expect(repo.saveServiceAreaTowns).toHaveBeenCalledWith({
      towns: DEV_FALLBACK_TOWNS,
      signature: serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 20 }),
    });
  });

  it('recomputes when only the drive-time limit changed', async () => {
    // Cache was built for 20 minutes; settings now say 30.
    const repo = makeRepo({
      max_drive_minutes: 30,
      service_area_signature: serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 20 }),
      service_area_towns: ['Old Town'],
    });

    await resolveServiceAreaTowns(repo);

    expect(repo.saveServiceAreaTowns).toHaveBeenCalledWith({
      towns: DEV_FALLBACK_TOWNS,
      signature: serviceAreaSignature({ originAddress: ORIGIN, maxDriveMinutes: 30 }),
    });
  });

  it('defaults max drive minutes to 20 when unset', async () => {
    const repo = makeRepo({ service_area_signature: null, service_area_towns: null });
    const result = await resolveServiceAreaTowns(repo);
    expect(result.maxDriveMinutes).toBe(20);
  });

  it('returns empty towns when no address is on file', async () => {
    const repo = makeRepo({ max_drive_minutes: 20 });
    repo.getBusinessContactInfo.mockResolvedValue(null);
    const result = await resolveServiceAreaTowns(repo);
    expect(result).toEqual({ towns: [], maxDriveMinutes: 20 });
    expect(repo.saveServiceAreaTowns).not.toHaveBeenCalled();
  });
});
