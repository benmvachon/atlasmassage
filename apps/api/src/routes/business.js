import { Router } from 'express';
import { getPool } from '../database/pool.js';
import { BusinessRepository } from '../repositories/businessRepository.js';
import { resolveServiceAreaTowns } from '../services/serviceAreaService.js';

const router = Router();

router.get('/hours', async (req, res, next) => {
  try {
    const repo = new BusinessRepository(getPool());
    const hours = await repo.getBusinessHours();
    res.json({ success: true, data: hours });
  } catch (err) {
    next(err);
  }
});

router.get('/restrictions', async (req, res, next) => {
  try {
    const repo = new BusinessRepository(getPool());
    const restrictions = await repo.getBookingRestrictions();
    res.json({ success: true, data: restrictions ?? { restrict_pregnancy: true, restrict_minors: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/contact-info', async (req, res, next) => {
  try {
    const repo = new BusinessRepository(getPool());
    const contactInfo = await repo.getBusinessContactInfo();
    res.json({ success: true, data: contactInfo });
  } catch (err) {
    next(err);
  }
});

router.get('/travel-settings', async (req, res, next) => {
  try {
    const repo = new BusinessRepository(getPool());
    const settings = await repo.getTravelSettings();
    res.json({ success: true, data: settings ?? { travel_mode_enabled: false } });
  } catch (err) {
    next(err);
  }
});

// Towns within the travel drive-time range. Computed on demand and cached in
// travel_settings; only recomputed when the address or drive-time limit change.
router.get('/service-area', async (req, res, next) => {
  try {
    const repo = new BusinessRepository(getPool());
    const data = await resolveServiceAreaTowns(repo);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
