"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const testingController_1 = require("../controllers/testingController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimitMiddleware_1 = require("../middleware/rateLimitMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticate);
router.use(authMiddleware_1.requireActive);
router.use(rateLimitMiddleware_1.rateLimit);
router.use(rateLimitMiddleware_1.usageTracker);
// Testing routes
router.post('/run', testingController_1.submitTestResults);
router.post('/fix', testingController_1.fixIssues);
router.get('/:id', testingController_1.getTestingSession);
exports.default = router;
//# sourceMappingURL=testing.routes.js.map