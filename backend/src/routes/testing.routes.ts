import { Router } from 'express';
import { submitTestResults, fixIssues, getTestingSession } from '../controllers/testingController';
import { authenticate, requireActive } from '../middleware/authMiddleware';
import { rateLimit, usageTracker } from '../middleware/rateLimitMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActive);
router.use(rateLimit);
router.use(usageTracker);

// Testing routes
router.post('/run', submitTestResults);
router.post('/fix', fixIssues);
router.get('/:id', getTestingSession);

export default router;

