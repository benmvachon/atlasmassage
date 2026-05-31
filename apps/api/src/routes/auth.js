import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  validate,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginRules, validate, authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', forgotPasswordRules, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordRules, validate, authController.resetPassword);

export default router;
