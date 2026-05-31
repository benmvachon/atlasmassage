import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.put('/me/password', authenticate, userController.changePassword);

router.get('/', authenticate, authorize('owner'), userController.listUsers);
router.get('/:id', authenticate, authorize('owner'), userController.getUser);
router.put('/:id', authenticate, authorize('owner'), userController.updateUser);
router.delete('/:id', authenticate, authorize('owner'), userController.deleteUser);

export default router;
