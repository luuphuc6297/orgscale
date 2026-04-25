import { z } from 'zod';

export const createRecipientSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(120).optional().nullable(),
});

export const listRecipientsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
});

export type CreateRecipientInput = z.infer<typeof createRecipientSchema>;
export type ListRecipientsQuery = z.infer<typeof listRecipientsQuery>;
