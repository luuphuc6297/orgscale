import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Recipient } from './recipient.model';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { ListRecipientsDto } from './dto/list-recipients.dto';

@Injectable()
export class RecipientsService {
  constructor(@InjectModel(Recipient) private readonly model: typeof Recipient) {}

  async list(params: ListRecipientsDto) {
    const { page, limit, search } = params;
    const where = search ? { email: { [Op.iLike]: `%${search}%` } } : {};
    const offset = (page - 1) * limit;
    const { rows, count } = await this.model.findAndCountAll({
      where,
      offset,
      limit,
      order: [['email', 'ASC']],
    });
    return { data: rows, total: count, page, limit };
  }

  async create(dto: CreateRecipientDto) {
    const [recipient] = await this.model.findOrCreate({
      where: { email: dto.email.toLowerCase() },
      defaults: { email: dto.email.toLowerCase(), name: dto.name ?? null } as any,
    });
    return recipient;
  }

  async ensureMany(emails: string[]): Promise<Recipient[]> {
    const normalized = Array.from(new Set(emails.map((e) => e.trim().toLowerCase())));
    const existing = await this.model.findAll({ where: { email: { [Op.in]: normalized } } });
    const existingEmails = new Set(existing.map((r) => r.email));
    const toCreate = normalized
      .filter((e) => !existingEmails.has(e))
      .map((email) => ({ email, name: null }));
    const created = toCreate.length > 0
      ? await this.model.bulkCreate(toCreate as any[])
      : [];
    return [...existing, ...created];
  }
}
