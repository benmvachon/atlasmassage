import { Router } from 'express';
import { getPool } from '../database/pool.js';
import { BusinessRepository } from '../repositories/businessRepository.js';

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

export default router;
