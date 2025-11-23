import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';
import { TestingFix } from './testingFix.model';

@Table({
    tableName: 'testing_sessions',
    timestamps: false
})
export class TestingSession extends Model {
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
        type: DataType.STRING(500),
        allowNull: false,
        field: 'tested_url'
    })
    testedUrl!: string;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'nvda_interactions'
    })
    nvdaInteractions!: any;

    @Column({
        type: DataType.JSONB,
        allowNull: false,
        field: 'test_results'
    })
    testResults!: any;

    @Column({
        type: DataType.JSONB,
        field: 'ai_validation_results'
    })
    aiValidationResults?: any;

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
        type: DataType.INTEGER,
        defaultValue: 0,
        field: 'total_issues'
    })
    totalIssues!: number;

    @Column({
        type: DataType.JSONB,
        field: 'severity_breakdown'
    })
    severityBreakdown?: any;

    // Associations
    @BelongsTo(() => User)
    user!: User;

    @HasMany(() => TestingFix)
    fixes!: TestingFix[];
}

