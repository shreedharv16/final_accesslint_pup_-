"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const chat_routes_1 = __importDefault(require("./chat.routes"));
const agent_routes_1 = __importDefault(require("./agent.routes"));
const testing_routes_1 = __importDefault(require("./testing.routes"));
const download_routes_1 = __importDefault(require("./download.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const router = (0, express_1.Router)();
// Mount routes
router.use('/auth', auth_routes_1.default);
router.use('/chat', chat_routes_1.default);
router.use('/agent', agent_routes_1.default);
router.use('/testing', testing_routes_1.default);
router.use('/download', download_routes_1.default);
router.use('/user', user_routes_1.default);
// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
exports.default = router;
//# sourceMappingURL=index.js.map