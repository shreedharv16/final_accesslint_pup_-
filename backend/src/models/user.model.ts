import { Table, Column, Model, DataType, Index, HasMany, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { Session } from './session.model';
import { ChatConversation } from './chatConversation.model';
import { AgentSession } from './agentSession.model';
import { TestingSession } from './testingSession.model';
import { VsixDownload } from './vsixDownload.model';

@Table({
    tableName: 'users',
    timestamps: false
})
export class User extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @Index
    @Column({
        type: DataType.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    })
    email!: string;

    @Column({
        type: DataType.STRING(255),
        allowNull: false
    })
    passwordHash!: string;

    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'created_at'
    })
    createdAt!: Date;

    @Column({
        type: DataType.DATE,
        field: 'last_login'
    })
    lastLogin?: Date;

    @Index
    @Column({
        type: DataType.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    })
    isActive!: boolean;

    @Column({
        type: DataType.INTEGER,
        defaultValue: 100,
        field: 'rate_limit_per_hour'
    })
    rateLimitPerHour!: number;

    @Column({
        type: DataType.INTEGER,
        defaultValue: 100000,
        field: 'rate_limit_tokens_per_day'
    })
    rateLimitTokensPerDay!: number;

    // Associations
    @HasMany(() => Session)
    sessions!: Session[];

    @HasMany(() => ChatConversation)
    chatConversations!: ChatConversation[];

    @HasMany(() => AgentSession)
    agentSessions!: AgentSession[];

    @HasMany(() => TestingSession)
    testingSessions!: TestingSession[];

    @HasMany(() => VsixDownload)
    vsixDownloads!: VsixDownload[];

    // Virtual fields (exclude password hash from JSON)
    toJSON() {
        const values = { ...this.get() };
        delete values.passwordHash;
        return values;
    }
}

