import { Router } from 'express';
import {
  listPublished,
  getPublishedBySlug,
  downloadPdf,
} from '../controllers/essayController.js';

// Public, read-only pathology essay API backing /pathology.
const router = Router();

router.get('/', listPublished);
router.get('/:slug', getPublishedBySlug);
router.get('/:slug/pdf', downloadPdf);

export default router;
