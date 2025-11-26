import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, Index, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { User } from './user.model';
import { ChatMessage } from './chatMessage.model';

@Table({
    tableName: 'chat_conversations',
    timestamps: false
})
export class ChatConversation extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @Index
    @ForeignKey(() => User)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: 'user_id'
    })
    userId!: string;

    @Index
    @Column({
        type: DataType.STRING(50),
        allowNull: false,
        field: 'conversation_type',
        validate: {
            isIn: [['quick_mode', 'agent_mode']]
        }
    })
    conversationType!: 'quick_mode' | 'agent_mode';

    @Column({
        type: DataType.STRING(255)
    })
    title?: string;

    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'created_at'
    })
    createdAt!: Date;

    @UpdatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'updated_at'
    })
    updatedAt!: Date;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: false,
        field: 'is_archived'
    })
    isArchived!: boolean;

    // Associations
    @BelongsTo(() => User)
    user!: User;

    @HasMany(() => ChatMessage)
    messages!: ChatMessage[];
}

export default ChatConversation;

