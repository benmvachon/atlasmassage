import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { updatePreferencesRules, validate } from '../validators/notificationValidators.js';

const router = Router();

router.get('/preferences', authenticate, notificationController.getPreferences);
router.put('/preferences', authenticate, updatePreferencesRules, validate, notificationController.updatePreferences);
router.get('/', authenticate, notificationController.listNotifications);

export default router;
