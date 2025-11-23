import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { AgentSession } from './agentSession.model';

@Table({
    tableName: 'agent_iterations',
    timestamps: false
})
export class AgentIteration extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @Index
    @ForeignKey(() => AgentSession)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: 'session_id'
    })
    sessionId!: string;

    @Index
    @Column({
        type: DataType.INTEGER,
        allowNull: false,
        field: 'iteration_number'
    })
    iterationNumber!: number;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'llm_request'
    })
    llmRequest!: any;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'llm_response'
    })
    llmResponse!: any;

    @Column({
        type: DataType.JSONB,
        field: 'tool_calls'
    })
    toolCalls?: any;

    @Column({
        type: DataType.JSONB,
        field: 'tool_results'
    })
    toolResults?: any;

    @Column({
        type: DataType.INTEGER,
        defaultValue: 0,
        field: 'tokens_used'
    })
    tokensUsed!: number;

    @Column({
        type: DataType.INTEGER,
        field: 'execution_time_ms'
    })
    executionTimeMs?: number;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW
    })
    timestamp!: Date;

    // Associations
    @BelongsTo(() => AgentSession)
    session!: AgentSession;
}

