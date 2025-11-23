import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';
import { AgentIteration } from './agentIteration.model';

@Table({
    tableName: 'agent_sessions',
    timestamps: false
})
export class AgentSession extends Model {
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
        field: 'session_type',
        validate: {
            isIn: [['chat_agent', 'testing_agent']]
        }
    })
    sessionType!: 'chat_agent' | 'testing_agent';

    @Column({
        type: DataType.TEXT,
        allowNull: false
    })
    goal!: string;

    @Index
    @Column({
        type: DataType.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['active', 'completed', 'error', 'timeout']]
        }
    })
    status!: 'active' | 'completed' | 'error' | 'timeout';

    @Column({
        type: DataType.INTEGER,
        defaultValue: 0,
        field: 'total_iterations'
    })
    totalIterations!: number;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'start_time'
    })
    startTime!: Date;

    @Column({
        type: DataType.DATE,
        field: 'end_time'
    })
    endTime?: Date;

    @Column({
        type: DataType.JSONB,
        field: 'file_changes'
    })
    fileChanges?: any;

    @Column({
        type: DataType.TEXT,
        field: 'completion_summary'
    })
    completionSummary?: string;

    @Column({
        type: DataType.TEXT,
        field: 'error_message'
    })
    errorMessage?: string;

    // Associations
    @BelongsTo(() => User)
    user!: User;

    @HasMany(() => AgentIteration)
    iterations!: AgentIteration[];
}

