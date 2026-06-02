import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import appointmentRoutes from './appointments.js';
import availabilityRoutes from './availability.js';
import paymentRoutes from './payments.js';
import membershipRoutes from './memberships.js';
import notificationRoutes from './notifications.js';
import adminRoutes from './admin.js';
import businessRoutes from './business.js';

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

export default router;
