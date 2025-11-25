"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentController_1 = require("../controllers/agentController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimitMiddleware_1 = require("../middleware/rateLimitMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticate);
router.use(authMiddleware_1.requireActive);
router.use(rateLimitMiddleware_1.rateLimit);
router.use(rateLimitMiddleware_1.usageTracker);
// Agent routes
router.post('/start', agentController_1.startAgent);
router.get('/:id/status', agentController_1.getSessionStatus);
router.get('/:id/logs', agentController_1.getSessionLogs);
exports.default = router;
//# sourceMappingURL=agent.routes.js.map