"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticate);
router.use(authMiddleware_1.requireActive);
// User routes
router.get('/profile', userController_1.getProfile);
router.get('/usage', userController_1.getUsage);
exports.default = router;
//# sourceMappingURL=user.routes.js.map