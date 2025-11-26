"use strict";
/**
 * Export all Sequelize models
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.models = exports.VsixDownload = exports.UsageStat = exports.DebugLog = exports.TestingFix = exports.TestingSession = exports.AgentIteration = exports.AgentSession = exports.ChatMessage = exports.ChatConversation = exports.Session = exports.User = void 0;
require("reflect-metadata"); // MUST be first for model decorators
var user_model_1 = require("./user.model");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return user_model_1.User; } });
var session_model_1 = require("./session.model");
Object.defineProperty(exports, "Session", { enumerable: true, get: function () { return session_model_1.Session; } });
var chatConversation_model_1 = require("./chatConversation.model");
Object.defineProperty(exports, "ChatConversation", { enumerable: true, get: function () { return chatConversation_model_1.ChatConversation; } });
var chatMessage_model_1 = require("./chatMessage.model");
Object.defineProperty(exports, "ChatMessage", { enumerable: true, get: function () { return chatMessage_model_1.ChatMessage; } });
var agentSession_model_1 = require("./agentSession.model");
Object.defineProperty(exports, "AgentSession", { enumerable: true, get: function () { return agentSession_model_1.AgentSession; } });
var agentIteration_model_1 = require("./agentIteration.model");
Object.defineProperty(exports, "AgentIteration", { enumerable: true, get: function () { return agentIteration_model_1.AgentIteration; } });
var testingSession_model_1 = require("./testingSession.model");
Object.defineProperty(exports, "TestingSession", { enumerable: true, get: function () { return testingSession_model_1.TestingSession; } });
var testingFix_model_1 = require("./testingFix.model");
Object.defineProperty(exports, "TestingFix", { enumerable: true, get: function () { return testingFix_model_1.TestingFix; } });
var debugLog_model_1 = require("./debugLog.model");
Object.defineProperty(exports, "DebugLog", { enumerable: true, get: function () { return debugLog_model_1.DebugLog; } });
var usageStat_model_1 = require("./usageStat.model");
Object.defineProperty(exports, "UsageStat", { enumerable: true, get: function () { return usageStat_model_1.UsageStat; } });
var vsixDownload_model_1 = require("./vsixDownload.model");
Object.defineProperty(exports, "VsixDownload", { enumerable: true, get: function () { return vsixDownload_model_1.VsixDownload; } });
// Export all models as an array for Sequelize initialization
const user_model_2 = require("./user.model");
const session_model_2 = require("./session.model");
const chatConversation_model_2 = require("./chatConversation.model");
const chatMessage_model_2 = require("./chatMessage.model");
const agentSession_model_2 = require("./agentSession.model");
const agentIteration_model_2 = require("./agentIteration.model");
const testingSession_model_2 = require("./testingSession.model");
const testingFix_model_2 = require("./testingFix.model");
const debugLog_model_2 = require("./debugLog.model");
const usageStat_model_2 = require("./usageStat.model");
const vsixDownload_model_2 = require("./vsixDownload.model");
exports.models = [
    user_model_2.User,
    session_model_2.Session,
    chatConversation_model_2.ChatConversation,
    chatMessage_model_2.ChatMessage,
    agentSession_model_2.AgentSession,
    agentIteration_model_2.AgentIteration,
    testingSession_model_2.TestingSession,
    testingFix_model_2.TestingFix,
    debugLog_model_2.DebugLog,
    usageStat_model_2.UsageStat,
    vsixDownload_model_2.VsixDownload
];
exports.default = exports.models;
//# sourceMappingURL=index.js.map