"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const downloadController_1 = require("../controllers/downloadController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(authMiddleware_1.authenticate);
router.use(authMiddleware_1.requireActive);
// Download routes
router.get('/vsix', downloadController_1.downloadVsix);
router.get('/versions', downloadController_1.getVersions);
exports.default = router;
//# sourceMappingURL=download.routes.js.map