import { Op } from 'sequelize';
import { Recipient } from './recipient.model';
import type { CreateRecipientInput, ListRecipientsQuery } from './recipients.schemas';

export class RecipientsService {
  constructor(private readonly model: typeof Recipient) {}

  async list(params: ListRecipientsQuery) {
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

  async create(input: CreateRecipientInput) {
    const [recipient] = await this.model.findOrCreate({
      where: { email: input.email.toLowerCase() },
      defaults: { email: input.email.toLowerCase(), name: input.name ?? null } as any,
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
