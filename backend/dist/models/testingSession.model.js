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
exports.TestingSession = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const user_model_1 = require("./user.model");
const testingFix_model_1 = require("./testingFix.model");
let TestingSession = class TestingSession extends sequelize_typescript_1.Model {
};
exports.TestingSession = TestingSession;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], TestingSession.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => user_model_1.User),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'user_id'
    }),
    __metadata("design:type", String)
], TestingSession.prototype, "userId", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(500),
        allowNull: false,
        field: 'tested_url'
    }),
    __metadata("design:type", String)
], TestingSession.prototype, "testedUrl", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: false,
        field: 'nvda_interactions'
    }),
    __metadata("design:type", Object)
], TestingSession.prototype, "nvdaInteractions", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        allowNull: false,
        field: 'test_results'
    }),
    __metadata("design:type", Object)
], TestingSession.prototype, "testResults", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'ai_validation_results'
    }),
    __metadata("design:type", Object)
], TestingSession.prototype, "aiValidationResults", void 0);
__decorate([
    sequelize_typescript_1.Index,
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW,
        field: 'start_time'
    }),
    __metadata("design:type", Date)
], TestingSession.prototype, "startTime", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        field: 'end_time'
    }),
    __metadata("design:type", Date)
], TestingSession.prototype, "endTime", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 0,
        field: 'total_issues'
    }),
    __metadata("design:type", Number)
], TestingSession.prototype, "totalIssues", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'severity_breakdown'
    }),
    __metadata("design:type", Object)
], TestingSession.prototype, "severityBreakdown", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => user_model_1.User),
    __metadata("design:type", user_model_1.User)
], TestingSession.prototype, "user", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => testingFix_model_1.TestingFix),
    __metadata("design:type", Array)
], TestingSession.prototype, "fixes", void 0);
exports.TestingSession = TestingSession = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'testing_sessions',
        timestamps: false
    })
], TestingSession);
//# sourceMappingURL=testingSession.model.js.map