"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionLogs = exports.getSessionStatus = exports.startAgent = void 0;
const orchestratorService_1 = require("../services/orchestratorService");
const models_1 = require("../models");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Start agent session
 * POST /api/agent/start
 * Body: { goal, sessionType: 'chat_agent' | 'testing_agent', workspaceRoot, workspaceFiles }
 */
exports.startAgent = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { goal, sessionType = 'chat_agent', workspaceRoot, workspaceFiles } = req.body;
    const userId = req.user.id;
    if (!goal) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Goal is required'
        });
        return;
    }
    if (!workspaceRoot) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Workspace root is required'
        });
        return;
    }
    // Convert workspaceFiles array to Map
    const filesMap = new Map();
    if (workspaceFiles && Array.isArray(workspaceFiles)) {
        for (const file of workspaceFiles) {
            filesMap.set(file.path, file.content);
        }
    }
    // Create orchestrator
    const orchestrator = new orchestratorService_1.OrchestratorService({
        maxIterations: 15,
        timeoutMs: 120000, // 2 minutes
        workspaceRoot,
        workspaceFiles: filesMap
    });
    // Start session
    const sessionId = await orchestrator.startSession(userId, sessionType, goal);
    // Run agent loop (this will take time)
    const result = await orchestrator.runAgentLoop();
    res.status(constants_1.HTTP_STATUS.OK).json({
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
exports.getSessionStatus = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const session = await models_1.AgentSession.findByPk(id);
    if (!session) {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: 'Session not found'
        });
        return;
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { session }
    });
});
/**
 * Get agent session logs (iterations)
 * GET /api/agent/:id/logs
 */
exports.getSessionLogs = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const session = await models_1.AgentSession.findByPk(id, {
        include: ['iterations']
    });
    if (!session) {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: 'Session not found'
        });
        return;
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: {
            session,
            iterations: session.iterations
        }
    });
});
exports.default = {
    startAgent: exports.startAgent,
    getSessionStatus: exports.getSessionStatus,
    getSessionLogs: exports.getSessionLogs
};
//# sourceMappingURL=agentController.js.map