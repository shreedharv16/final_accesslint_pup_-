import { Router } from 'express';
import authRoutes from './auth.routes';
import chatRoutes from './chat.routes';
import agentRoutes from './agent.routes';
import testingRoutes from './testing.routes';
import downloadRoutes from './download.routes';
import userRoutes from './user.routes';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/agent', agentRoutes);
router.use('/testing', testingRoutes);
router.use('/download', downloadRoutes);
router.use('/user', userRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

export default router;

