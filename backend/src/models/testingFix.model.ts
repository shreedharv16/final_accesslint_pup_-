import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { TestingSession } from './testingSession.model';
import { AgentSession } from './agentSession.model';

@Table({
    tableName: 'testing_fixes',
    timestamps: false
})
export class TestingFix extends Model {
    @Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true
    })
    id!: string;

    @Index
    @ForeignKey(() => TestingSession)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: 'testing_session_id'
    })
    testingSessionId!: string;

    @Index
    @ForeignKey(() => AgentSession)
    @Column({
        type: DataType.UUID,
        allowNull: false,
        field: 'agent_session_id'
    })
    agentSessionId!: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'files_modified'
    })
    filesModified!: any;

    @Column({
        type: DataType.TEXT,
        field: 'fix_summary'
    })
    fixSummary?: string;

    @Column({
        type: DataType.BOOLEAN,
        defaultValue: true
    })
    success!: boolean;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW
    })
    timestamp!: Date;

    // Associations
    @BelongsTo(() => TestingSession)
    testingSession!: TestingSession;

    @BelongsTo(() => AgentSession)
    agentSession!: AgentSession;
}

export default TestingFix;

