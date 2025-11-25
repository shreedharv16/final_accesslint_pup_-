"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public routes
router.post('/register', authController_1.register);
router.post('/login', authController_1.login);
router.post('/refresh', authController_1.refresh);
// Protected routes
router.post('/logout', authMiddleware_1.authenticate, authController_1.logout);
router.get('/me', authMiddleware_1.authenticate, authController_1.me);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map