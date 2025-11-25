"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestingSession = exports.fixIssues = exports.submitTestResults = void 0;
const models_1 = require("../models");
const orchestratorService_1 = require("../services/orchestratorService");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Submit test results (from VSCode extension)
 * POST /api/testing/run
 * Body: { url, nvdaInteractions, testResults, aiValidationResults }
 */
exports.submitTestResults = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { url, nvdaInteractions, testResults, aiValidationResults } = req.body;
    const userId = req.user.id;
    if (!url || !nvdaInteractions || !testResults) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'URL, NVDA interactions, and test results are required'
        });
        return;
    }
    // Calculate severity breakdown
    const severityBreakdown = {
        errors: testResults.filter((i) => i.severity === 'error').length,
        warnings: testResults.filter((i) => i.severity === 'warning').length,
        info: testResults.filter((i) => i.severity === 'info').length
    };
    // Create testing session
    const session = await models_1.TestingSession.create({
        userId,
        testedUrl: url,
        nvdaInteractions,
        testResults,
        aiValidationResults,
        totalIssues: testResults.length,
        severityBreakdown,
        endTime: new Date()
    });
    res.status(constants_1.HTTP_STATUS.CREATED).json({
        data: {
            sessionId: session.id,
            totalIssues: session.totalIssues,
            severityBreakdown: session.severityBreakdown
        }
    });
});
/**
 * Request agent to fix issues
 * POST /api/testing/fix
 * Body: { sessionId, workspaceRoot, workspaceFiles }
 */
exports.fixIssues = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { sessionId, workspaceRoot, workspaceFiles } = req.body;
    const userId = req.user.id;
    if (!sessionId || !workspaceRoot) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Session ID and workspace root are required'
        });
        return;
    }
    // Get testing session
    const testingSession = await models_1.TestingSession.findByPk(sessionId);
    if (!testingSession) {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: 'Testing session not found'
        });
        return;
    }
    // Convert workspaceFiles to Map
    const filesMap = new Map();
    if (workspaceFiles && Array.isArray(workspaceFiles)) {
        for (const file of workspaceFiles) {
            filesMap.set(file.path, file.content);
        }
    }
    // Create goal for agent
    const issuesCount = testingSession.totalIssues;
    const url = testingSession.testedUrl;
    const goal = `Fix accessibility issues found during testing of ${url}. Found ${issuesCount} issues. Focus on high-priority issues (errors and warnings). Make the code WCAG 2.1 AA compliant.`;
    // Create orchestrator
    const orchestrator = new orchestratorService_1.OrchestratorService({
        maxIterations: 15,
        timeoutMs: 120000,
        workspaceRoot,
        workspaceFiles: filesMap
    });
    // Start agent session
    const agentSessionId = await orchestrator.startSession(userId, 'testing_agent', goal);
    // Run agent
    const result = await orchestrator.runAgentLoop();
    // Save fix record
    if (result.success) {
        await models_1.TestingFix.create({
            testingSessionId: sessionId,
            agentSessionId,
            filesModified: result.fileChanges,
            fixSummary: result.result,
            success: true
        });
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: {
            agentSessionId,
            success: result.success,
            result: result.result,
            fileChanges: result.fileChanges,
            error: result.error
        }
    });
});
/**
 * Get testing session
 * GET /api/testing/:id
 */
exports.getTestingSession = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const session = await models_1.TestingSession.findByPk(id, {
        include: ['fixes']
    });
    if (!session) {
        res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
            error: 'Testing session not found'
        });
        return;
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { session }
    });
});
exports.default = {
    submitTestResults: exports.submitTestResults,
    fixIssues: exports.fixIssues,
    getTestingSession: exports.getTestingSession
};
//# sourceMappingURL=testingController.js.map