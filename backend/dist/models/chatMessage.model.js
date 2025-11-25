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
exports.ChatMessage = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const chatConversation_model_1 = require("./chatConversation.model");
let ChatMessage = class ChatMessage extends sequelize_typescript_1.Model {
};
exports.ChatMessage = ChatMessage;
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        defaultValue: sequelize_typescript_1.DataType.UUIDV4,
        primaryKey: true
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "id", void 0);
__decorate([
    sequelize_typescript_1.Index,
    (0, sequelize_typescript_1.ForeignKey)(() => chatConversation_model_1.ChatConversation),
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.UUID,
        allowNull: false,
        field: 'conversation_id'
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "conversationId", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['user', 'assistant', 'system']]
        }
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "role", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.TEXT,
        allowNull: false
    }),
    __metadata("design:type", String)
], ChatMessage.prototype, "content", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.JSONB,
        field: 'tool_calls'
    }),
    __metadata("design:type", Object)
], ChatMessage.prototype, "toolCalls", void 0);
__decorate([
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.INTEGER,
        defaultValue: 0,
        field: 'tokens_used'
    }),
    __metadata("design:type", Number)
], ChatMessage.prototype, "tokensUsed", void 0);
__decorate([
    sequelize_typescript_1.Index,
    sequelize_typescript_1.CreatedAt,
    (0, sequelize_typescript_1.Column)({
        type: sequelize_typescript_1.DataType.DATE,
        defaultValue: sequelize_typescript_1.DataType.NOW
    }),
    __metadata("design:type", Date)
], ChatMessage.prototype, "timestamp", void 0);
__decorate([
    (0, sequelize_typescript_1.BelongsTo)(() => chatConversation_model_1.ChatConversation),
    __metadata("design:type", chatConversation_model_1.ChatConversation)
], ChatMessage.prototype, "conversation", void 0);
exports.ChatMessage = ChatMessage = __decorate([
    (0, sequelize_typescript_1.Table)({
        tableName: 'chat_messages',
        timestamps: false
    })
], ChatMessage);
//# sourceMappingURL=chatMessage.model.js.map