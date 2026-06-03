import { Router } from 'express';
import { listPublished } from '../controllers/testimonialController.js';

const router = Router();

router.get('/', listPublished);

export default router;
