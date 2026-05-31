import { Router } from 'express';
import * as authController from '../controllers/authController.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

export default router;
