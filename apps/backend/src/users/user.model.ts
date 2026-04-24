import {
  Column,
  DataType,
  DefaultScope,
  HasMany,
  Model,
  Scopes,
  Table,
} from 'sequelize-typescript';
import { Campaign } from '../campaigns/campaign.model';

@DefaultScope(() => ({ attributes: { exclude: ['passwordHash'] } }))
@Scopes(() => ({
  withPassword: { attributes: { include: ['passwordHash'] } },
}))
@Table({ tableName: 'users', timestamps: true, underscored: true })
export class User extends Model<User> {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(255), allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING(120), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(255), allowNull: false, field: 'password_hash' })
  declare passwordHash: string;

  @HasMany(() => Campaign, { foreignKey: 'createdBy' })
  declare campaigns?: Campaign[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
