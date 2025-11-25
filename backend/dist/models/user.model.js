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
exports.User = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const session_model_1 = require("./session.model");
const chatConversation_model_1 = require("./chatConversation.model");
const agentSession_model_1 = require("./agentSession.model");
const testingSession_model_1 = require("./testingSession.model");
const vsixDownload_model_1 = require("./vsixDownload.model");
let User = class User extends sequelize_typescript_1.Model {
    // Virtual fields (exclude password hash from JSON)
    toJSON() {
        const values = { ...this.get() };
        delete values.passwordHash;
        return values;
    }
};
exports.User = User;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(255),
        allowNull: false
    }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW,
        field: 'created_at'
    }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        field: 'last_login'
    }),
    __metadata("design:type", Date)
], User.prototype, "lastLogin", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 100,
        field: 'rate_limit_per_hour'
    }),
    __metadata("design:type", Number)
], User.prototype, "rateLimitPerHour", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 100000,
        field: 'rate_limit_tokens_per_day'
    }),
    __metadata("design:type", Number)
], User.prototype, "rateLimitTokensPerDay", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => session_model_1.Session),
    __metadata("design:type", Array)
], User.prototype, "sessions", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => chatConversation_model_1.ChatConversation),
    __metadata("design:type", Array)
], User.prototype, "chatConversations", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => agentSession_model_1.AgentSession),
    __metadata("design:type", Array)
], User.prototype, "agentSessions", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => testingSession_model_1.TestingSession),
    __metadata("design:type", Array)
], User.prototype, "testingSessions", void 0);
__decorate([
    (0, sequelize_typescript_1.HasMany)(() => vsixDownload_model_1.VsixDownload),
    __metadata("design:type", Array)
], User.prototype, "vsixDownloads", void 0);
exports.User = User = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'users',
        timestamps: false
    })
], User);
//# sourceMappingURL=user.model.js.map