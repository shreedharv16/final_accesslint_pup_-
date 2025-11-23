import { Table, Column, Model, DataType, ForeignKey, BelongsTo, Index, CreatedAt } from 'sequelize-typescript';
import { User } from './user.model';

@Table({
    tableName: 'vsix_downloads',
    timestamps: false
})
export class VsixDownload extends Model {
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
        type: DataType.STRING(20),
        allowNull: false,
        field: 'vsix_version'
    })
    vsixVersion!: string;

    @Index
    @CreatedAt
    @Column({
        type: DataType.DATE,
        defaultValue: DataType.NOW,
        field: 'download_timestamp'
    })
    downloadTimestamp!: Date;

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

