import { Router } from 'express';
import {
  listJoints,
  getJoint,
  getJointAction,
  getMuscle,
} from '../controllers/anatomyController.js';

// Public, read-only kinesiology / myology reference API.
const router = Router();

router.get('/joints', listJoints);
router.get('/joints/:slug', getJoint);
router.get('/joints/:slug/actions/:actionSlug', getJointAction);
router.get('/muscles/:slug', getMuscle);

export default router;
