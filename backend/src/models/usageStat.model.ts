import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';

@Table({
    tableName: 'usage_stats',
    timestamps: false
})
export class UsageStat extends Model {
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
        type: DataType.STRING(100),
        allowNull: false
    })
    endpoint!: string;

    @Column({
        type: DataType.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['GET', 'POST', 'PUT', 'DELETE', 'PATCH']]
        }
    })
    method!: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

    @Column({
        type: DataType.INTEGER,
        field: 'status_code'
    })
    statusCode?: number;

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
    @BelongsTo(() => User)
    user!: User;
}

