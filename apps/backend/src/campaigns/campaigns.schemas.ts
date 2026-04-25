import { z } from 'zod';

const campaignStatusEnum = z.enum(['draft', 'scheduled', 'sending', 'sent']);

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  body: z.string().min(1),
  recipientEmails: z.array(z.string().email()).min(1).max(1000),
});

export const updateCampaignSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(300).optional(),
    body: z.string().min(1).optional(),
    recipientEmails: z.array(z.string().email()).min(1).max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listCampaignsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: campaignStatusEnum.optional(),
});

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const campaignIdParams = z.object({ id: z.string().uuid() });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsInput = z.infer<typeof listCampaignsQuery>;
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;
