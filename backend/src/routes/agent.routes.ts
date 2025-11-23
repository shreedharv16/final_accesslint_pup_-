import { Router } from 'express';
import { startAgent, getSessionStatus, getSessionLogs } from '../controllers/agentController';
import { authenticate, requireActive } from '../middleware/authMiddleware';
import { rateLimit, usageTracker } from '../middleware/rateLimitMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActive);
router.use(rateLimit);
router.use(usageTracker);

// Agent routes
router.post('/start', startAgent);
router.get('/:id/status', getSessionStatus);
router.get('/:id/logs', getSessionLogs);

export default router;

