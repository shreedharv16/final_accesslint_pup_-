import { Request, Response } from 'express';
import { OrchestratorService } from '../services/orchestratorService';
import { AgentSession } from '../models';
import { HTTP_STATUS } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Start agent session
 * POST /api/agent/start
 * Body: { goal, sessionType: 'chat_agent' | 'testing_agent', workspaceRoot, workspaceFiles }
 */
export const startAgent = asyncHandler(async (req: Request, res: Response) => {
    const { goal, sessionType = 'chat_agent', workspaceRoot, workspaceFiles } = req.body;
    const userId = req.user!.id;

    if (!goal) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Goal is required'
        });
        return;
    }

    if (!workspaceRoot) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Workspace root is required'
        });
        return;
    }

    // Convert workspaceFiles array to Map
    const filesMap = new Map<string, string>();
    if (workspaceFiles && Array.isArray(workspaceFiles)) {
        for (const file of workspaceFiles) {
            filesMap.set(file.path, file.content);
        }
    }

    // Create orchestrator
    const orchestrator = new OrchestratorService({
        maxIterations: 15,
        timeoutMs: 120000, // 2 minutes
        workspaceRoot,
        workspaceFiles: filesMap
    });

    // Start session
    const sessionId = await orchestrator.startSession(userId, sessionType, goal);

    // Run agent loop (this will take time)
    const result = await orchestrator.runAgentLoop();

    res.status(HTTP_STATUS.OK).json({
        data: {
            sessionId,
            success: result.success,
            result: result.result,
            fileChanges: result.fileChanges,
            error: result.error
        }
    });
});

/**
 * Get agent session status
 * GET /api/agent/:id/status
 */
export const getSessionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const session = await AgentSession.findByPk(id);

    if (!session) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: 'Session not found'
        });
        return;
    }

    res.status(HTTP_STATUS.OK).json({
        data: { session }
    });
});

/**
 * Get agent session logs (iterations)
 * GET /api/agent/:id/logs
 */
export const getSessionLogs = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const session = await AgentSession.findByPk(id, {
        include: ['iterations']
    });

    if (!session) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: 'Session not found'
        });
        return;
    }

    res.status(HTTP_STATUS.OK).json({
        data: {
            session,
            iterations: (session as any).iterations
        }
    });
});

export default {
    startAgent,
    getSessionStatus,
    getSessionLogs
};

