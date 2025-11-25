"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatController_1 = require("../controllers/chatController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const rateLimitMiddleware_1 = require("../middleware/rateLimitMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticate);
router.use(authMiddleware_1.requireActive);
router.use(rateLimitMiddleware_1.rateLimit);
router.use(rateLimitMiddleware_1.usageTracker);
// Chat routes
router.post('/message', chatController_1.sendMessage);
router.get('/conversations', chatController_1.getConversations);
router.get('/conversations/:id/messages', chatController_1.getMessages);
exports.default = router;
//# sourceMappingURL=chat.routes.js.map