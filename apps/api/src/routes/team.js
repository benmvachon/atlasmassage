import { Router } from 'express';
import { getPool } from '../database/pool.js';
import { TherapistRepository } from '../repositories/therapistRepository.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const repo = new TherapistRepository(getPool());
    const all = await repo.findAll();
    const active = all.filter(t => t.is_active);
    res.json({ success: true, data: active });
  } catch (err) {
    next(err);
  }
});

export default router;
