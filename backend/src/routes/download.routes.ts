import { Router } from 'express';
import { downloadVsix, getVersions } from '../controllers/downloadController';
import { authenticate, requireActive } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(requireActive);

// Download routes
router.get('/vsix', downloadVsix);
router.get('/versions', getVersions);

export default router;

