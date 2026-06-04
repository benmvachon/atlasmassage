import { Router } from 'express';
import { config } from '../config/index.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import appointmentRoutes from './appointments.js';
import availabilityRoutes from './availability.js';
import paymentRoutes from './payments.js';
import membershipRoutes from './memberships.js';
import notificationRoutes from './notifications.js';
import adminRoutes from './admin.js';
import businessRoutes from './business.js';
import teamRoutes from './team.js';
import testimonialsRoutes from './testimonials.js';
import debugRoutes from './debug.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/availability', availabilityRoutes);
router.use('/payments', paymentRoutes);
router.use('/memberships', membershipRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/business', businessRoutes);
router.use('/team', teamRoutes);
router.use('/testimonials', testimonialsRoutes);

if (config.env !== 'production') {
  router.use('/debug', (req, res, next) => {
    if (req.headers['x-debug-secret'] !== config.debugSecret) {
      return res.status(404).end();
    }
    next();
  }, debugRoutes);
}

export default router;
