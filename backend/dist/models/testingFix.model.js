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
exports.TestingFix = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const testingSession_model_1 = require("./testingSession.model");
const agentSession_model_1 = require("./agentSession.model");
let TestingFix = class TestingFix extends sequelize_typescript_1.Model {
};
exports.TestingFix = TestingFix;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], TestingFix.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => testingSession_model_1.TestingSession),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'testing_session_id'
    }),
    __metadata("design:type", String)
], TestingFix.prototype, "testingSessionId", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => agentSession_model_1.AgentSession),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'agent_session_id'
    }),
    __metadata("design:type", String)
], TestingFix.prototype, "agentSessionId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: false,
        field: 'files_modified'
    }),
    __metadata("design:type", Object)
], TestingFix.prototype, "filesModified", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        field: 'fix_summary'
    }),
    __metadata("design:type", String)
], TestingFix.prototype, "fixSummary", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: true
    }),
    __metadata("design:type", Boolean)
], TestingFix.prototype, "success", void 0);
__decorate([
    sequelize_typescript_1.Index,
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW
    }),
    __metadata("design:type", Date)
], TestingFix.prototype, "timestamp", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => testingSession_model_1.TestingSession),
    __metadata("design:type", testingSession_model_1.TestingSession)
], TestingFix.prototype, "testingSession", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => agentSession_model_1.AgentSession),
    __metadata("design:type", agentSession_model_1.AgentSession)
], TestingFix.prototype, "agentSession", void 0);
exports.TestingFix = TestingFix = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'testing_fixes',
        timestamps: false
    })
], TestingFix);
//# sourceMappingURL=testingFix.model.js.map