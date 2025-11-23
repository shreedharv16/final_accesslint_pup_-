import { Router } from 'express';
import { sendMessage, getConversations, getMessages } from '../controllers/chatController';
import { authenticate, requireActive } from '../middleware/authMiddleware';
import { rateLimit, usageTracker } from '../middleware/rateLimitMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActive);
router.use(rateLimit);
router.use(usageTracker);

// Chat routes
router.post('/message', sendMessage);
router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);

export default router;

