export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipient {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  open_rate: number;
  send_rate: number;
}

export interface CampaignRecipientRow {
  recipientId: string;
  email: string;
  name: string | null;
  status: RecipientStatus;
  sentAt: string | null;
  openedAt: string | null;
}

export interface CampaignDetail extends Campaign {
  stats: CampaignStats;
  recipients: CampaignRecipientRow[];
}

export interface CampaignListResponse {
  data: Campaign[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCampaignDto {
  name: string;
  subject: string;
  body: string;
  recipientEmails: string[];
}

export interface UpdateCampaignDto {
  name?: string;
  subject?: string;
  body?: string;
  recipientEmails?: string[];
}

export interface ScheduleCampaignDto {
  scheduledAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
