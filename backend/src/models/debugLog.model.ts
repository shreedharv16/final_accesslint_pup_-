import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';

@Table({
    tableName: 'debug_logs',
    timestamps: false
})
export class DebugLog extends Model {
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
        field: 'user_id'
    })
    userId?: string;

    @Index
    @Column({
        type: DataType.UUID,
        field: 'session_id'
    })
    sessionId?: string;

    @Index
    @Column({
        type: DataType.STRING(50),
        field: 'session_type',
        validate: {
            isIn: [['agent', 'testing', 'chat', 'general']]
        }
    })
    sessionType?: 'agent' | 'testing' | 'chat' | 'general';

    @Index
    @Column({
        type: DataType.STRING(20),
        allowNull: false,
        field: 'log_level',
        validate: {
            isIn: [['INFO', 'WARN', 'ERROR', 'DEBUG']]
        }
    })
    logLevel!: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

    @Column({
        type: DataType.TEXT,
        allowNull: false
    })
    message!: string;

    @Column({
        type: DataType.JSONB
    })
    context?: any;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW
    })
    timestamp!: Date;

    // Associations
    @BelongsTo(() => User)
    user?: User;
}

