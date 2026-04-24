import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Campaign } from './campaign.model';
import { Recipient } from '../recipients/recipient.model';

export type RecipientStatus = 'pending' | 'sent' | 'failed';

@Table({ tableName: 'campaign_recipients', timestamps: true, underscored: true })
export class CampaignRecipient extends Model<CampaignRecipient> {
  @ForeignKey(() => Campaign)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false, field: 'campaign_id' })
  declare campaignId: string;

  @ForeignKey(() => Recipient)
  @Column({ type: DataType.UUID, primaryKey: true, allowNull: false, field: 'recipient_id' })
  declare recipientId: string;

  @Column({
    type: DataType.ENUM('pending', 'sent', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  })
  declare status: RecipientStatus;

  @Column({ type: DataType.DATE, allowNull: true, field: 'sent_at' })
  declare sentAt: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'opened_at' })
  declare openedAt: Date | null;

  @BelongsTo(() => Campaign)
  declare campaign?: Campaign;

  @BelongsTo(() => Recipient)
  declare recipient?: Recipient;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
