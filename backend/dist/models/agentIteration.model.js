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
exports.AgentIteration = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const agentSession_model_1 = require("./agentSession.model");
let AgentIteration = class AgentIteration extends sequelize_typescript_1.Model {
};
exports.AgentIteration = AgentIteration;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], AgentIteration.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => agentSession_model_1.AgentSession),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'session_id'
    }),
    __metadata("design:type", String)
], AgentIteration.prototype, "sessionId", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        allowNull: false,
        field: 'iteration_number'
    }),
    __metadata("design:type", Number)
], AgentIteration.prototype, "iterationNumber", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: false,
        field: 'llm_request'
    }),
    __metadata("design:type", Object)
], AgentIteration.prototype, "llmRequest", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: false,
        field: 'llm_response'
    }),
    __metadata("design:type", Object)
], AgentIteration.prototype, "llmResponse", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'tool_calls'
    }),
    __metadata("design:type", Object)
], AgentIteration.prototype, "toolCalls", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'tool_results'
    }),
    __metadata("design:type", Object)
], AgentIteration.prototype, "toolResults", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 0,
        field: 'tokens_used'
    }),
    __metadata("design:type", Number)
], AgentIteration.prototype, "tokensUsed", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        field: 'execution_time_ms'
    }),
    __metadata("design:type", Number)
], AgentIteration.prototype, "executionTimeMs", void 0);
__decorate([
    sequelize_typescript_1.Index,
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW
    }),
    __metadata("design:type", Date)
], AgentIteration.prototype, "timestamp", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => agentSession_model_1.AgentSession),
    __metadata("design:type", agentSession_model_1.AgentSession)
], AgentIteration.prototype, "session", void 0);
exports.AgentIteration = AgentIteration = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'agent_iterations',
        timestamps: false
    })
], AgentIteration);
//# sourceMappingURL=agentIteration.model.js.map