"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSession = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const user_model_1 = require("./user.model");
const agentIteration_model_1 = require("./agentIteration.model");
let AgentSession = class AgentSession extends sequelize_typescript_1.Model {
};
exports.AgentSession = AgentSession;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => user_model_1.User),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'user_id'
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "userId", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(50),
        allowNull: false,
        field: 'session_type',
        validate: {
            isIn: [['chat_agent', 'testing_agent']]
        }
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "sessionType", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        allowNull: false
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "goal", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['active', 'completed', 'error', 'timeout']]
        }
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "status", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 0,
        field: 'total_iterations'
    }),
    __metadata("design:type", Number)
], AgentSession.prototype, "totalIterations", void 0);
__decorate([
    sequelize_typescript_1.Index,
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW,
        field: 'start_time'
    }),
    __metadata("design:type", Date)
], AgentSession.prototype, "startTime", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        field: 'end_time'
    }),
    __metadata("design:type", Date)
], AgentSession.prototype, "endTime", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'file_changes'
    }),
    __metadata("design:type", Object)
], AgentSession.prototype, "fileChanges", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        field: 'completion_summary'
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "completionSummary", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        field: 'error_message'
    }),
    __metadata("design:type", String)
], AgentSession.prototype, "errorMessage", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => user_model_1.User),
    __metadata("design:type", user_model_1.User)
], AgentSession.prototype, "user", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => agentIteration_model_1.AgentIteration),
    __metadata("design:type", Array)
], AgentSession.prototype, "iterations", void 0);
exports.AgentSession = AgentSession = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'agent_sessions',
        timestamps: false
    })
], AgentSession);
exports.default = AgentSession;
//# sourceMappingURL=agentSession.model.js.map