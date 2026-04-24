import {
  BelongsToMany,
  Column,
  DataType,
  Model,
  Table,
} from 'sequelize-typescript';
import { Campaign } from '../campaigns/campaign.model';
import { CampaignRecipient } from '../campaigns/campaign-recipient.model';

@Table({ tableName: 'recipients', timestamps: true, underscored: true })
export class Recipient extends Model<Recipient> {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  declare id: string;

  @Column({ type: DataType.STRING(255), allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING(120), allowNull: true })
  declare name: string | null;

  @BelongsToMany(() => Campaign, () => CampaignRecipient)
  declare campaigns?: Campaign[];

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
