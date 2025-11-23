import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';

@Table({
    tableName: 'sessions',
    timestamps: false
})
export class Session extends Model {
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
        field: 'access_token'
    })
    accessToken!: string;

    @Column({
        type: DataType.STRING(500),
        allowNull: false,
        field: 'refresh_token'
    })
    refreshToken!: string;

    @Index
    @Column({
        type: DataType.DATE,
        allowNull: false,
        field: 'expires_at'
    })
    expiresAt!: Date;

    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'created_at'
    })
    createdAt!: Date;

    @Column({
        type: DataType.STRING(45),
        field: 'ip_address'
    })
    ipAddress?: string;

    @Column({
        type: DataType.TEXT,
        field: 'user_agent'
    })
    userAgent?: string;

    // Associations
    @BelongsTo(() => User)
    user!: User;
}

