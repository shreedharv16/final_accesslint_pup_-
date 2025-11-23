import { Request, Response } from 'express';
import { TestingSession, TestingFix } from '../models';
import { OrchestratorService } from '../services/orchestratorService';
import { HTTP_STATUS } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Submit test results (from VSCode extension)
 * POST /api/testing/run
 * Body: { url, nvdaInteractions, testResults, aiValidationResults }
 */
export const submitTestResults = asyncHandler(async (req: Request, res: Response) => {
    const { url, nvdaInteractions, testResults, aiValidationResults } = req.body;
    const userId = req.user!.id;

    if (!url || !nvdaInteractions || !testResults) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'URL, NVDA interactions, and test results are required'
        });
        return;
    }

    // Calculate severity breakdown
    const severityBreakdown = {
        errors: testResults.filter((i: any) => i.severity === 'error').length,
        warnings: testResults.filter((i: any) => i.severity === 'warning').length,
        info: testResults.filter((i: any) => i.severity === 'info').length
    };

    // Create testing session
    const session = await TestingSession.create({
        userId,
        testedUrl: url,
        nvdaInteractions,
        testResults,
        aiValidationResults,
        totalIssues: testResults.length,
        severityBreakdown,
        endTime: new Date()
    });

    res.status(HTTP_STATUS.CREATED).json({
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
export const fixIssues = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, workspaceRoot, workspaceFiles } = req.body;
    const userId = req.user!.id;

    if (!sessionId || !workspaceRoot) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Session ID and workspace root are required'
        });
        return;
    }

    // Get testing session
    const testingSession = await TestingSession.findByPk(sessionId);
    if (!testingSession) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: 'Testing session not found'
        });
        return;
    }

    // Convert workspaceFiles to Map
    const filesMap = new Map<string, string>();
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
    const orchestrator = new OrchestratorService({
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
        await TestingFix.create({
            testingSessionId: sessionId,
            agentSessionId,
            filesModified: result.fileChanges,
            fixSummary: result.result,
            success: true
        });
    }

    res.status(HTTP_STATUS.OK).json({
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
export const getTestingSession = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const session = await TestingSession.findByPk(id, {
        include: ['fixes']
    });

    if (!session) {
        res.status(HTTP_STATUS.NOT_FOUND).json({
            error: 'Testing session not found'
        });
        return;
    }

    res.status(HTTP_STATUS.OK).json({
        data: { session }
    });
});

export default {
    submitTestResults,
    fixIssues,
    getTestingSession
};

