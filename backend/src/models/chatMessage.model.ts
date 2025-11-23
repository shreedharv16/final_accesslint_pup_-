import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { ChatConversation } from './chatConversation.model';

@Table({
    tableName: 'chat_messages',
    timestamps: false
})
export class ChatMessage extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @Index
    @ForeignKey(() => ChatConversation)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: 'conversation_id'
    })
    conversationId!: string;

    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['user', 'assistant', 'system']]
        }
    })
    role!: 'user' | 'assistant' | 'system';

    @Column({
        type: DataType.TEXT,
        allowNull: false
    })
    content!: string;

    @Column({
        type: DataType.JSONB,
        field: 'tool_calls'
    })
    toolCalls?: any;

    @Column({
        type: DataType.INTEGER,
        defaultValue: 0,
        field: 'tokens_used'
    })
    tokensUsed!: number;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW
    })
    timestamp!: Date;

    // Associations
    @BelongsTo(() => ChatConversation)
    conversation!: ChatConversation;
}

