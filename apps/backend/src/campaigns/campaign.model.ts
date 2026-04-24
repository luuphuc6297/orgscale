import {
  BelongsTo,
  BelongsToMany,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from 'sequelize-typescript';
import { User } from '../users/user.model';
import { Recipient } from '../recipients/recipient.model';
import { CampaignRecipient } from './campaign-recipient.model';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';

@Table({ tableName: 'campaigns', timestamps: true, underscored: true })
export class Campaign extends Model<Campaign> {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare subject: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare body: string;

  @Column({
    type: DataType.ENUM('draft', 'scheduled', 'sending', 'sent'),
    allowNull: false,
    defaultValue: 'draft',
  })
  declare status: CampaignStatus;

  @Column({ type: DataType.DATE, allowNull: true, field: 'scheduled_at' })
  declare scheduledAt: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false, field: 'created_by' })
  declare createdBy: string;

  @BelongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator?: User;

  @HasMany(() => CampaignRecipient)
  declare campaignRecipients?: CampaignRecipient[];

  @BelongsToMany(() => Recipient, () => CampaignRecipient)
  declare recipients?: Recipient[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
