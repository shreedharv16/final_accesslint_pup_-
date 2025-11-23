import { Router } from 'express';
import { getProfile, getUsage } from '../controllers/userController';
import { authenticate, requireActive } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActive);

// User routes
router.get('/profile', getProfile);
router.get('/usage', getUsage);

export default router;

