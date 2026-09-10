import { apiClient } from './apiClient';

export interface IntegrationSetting {
  id?: number;
  type: string;
  provider: string;
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  isActive: boolean;

  // Limit config
  limitType?: 'HOURLY' | 'DAILY' | 'MONTHLY';
  emailLimit?: number | null;
  dailyLimit?: number | null; // backward-compat

  // Usage counters
  emailsSentThisHour?: number;
  emailsSentToday?: number;
  emailsSentThisMonth?: number;
  lastEmailSentDate?: string | null;
  currentPeriodStart?: string | null;
}

export interface EmailLimitAuditLog {
  id: number;
  changedByUserId: number | null;
  changedByName: string | null;
  prevLimitType: string | null;
  newLimitType: string | null;
  prevLimit: number | null;
  newLimit: number | null;
  reason: string | null;
  createdAt: string;
}

export interface MessageLog {
  id: number;
  channel: string;
  eventType: string;
  details?: string | null;
  createdAt: string;
  lead?: { id: number; name: string; email?: string | null; phone?: string | null } | null;
  campaign?: { id: number; name: string } | null;
}

export interface MessageLogsParams {
  channel?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const settingsService = {
  getAllIntegrations: async () => {
    const response = await apiClient.get('/settings/integrations');
    return response.data;
  },

  updateIntegration: async (type: string, data: Partial<IntegrationSetting> & { reason?: string }) => {
    const response = await apiClient.put(`/settings/integrations/${type}`, data);
    return response.data;
  },

  testIntegration: async (type: string, data?: Partial<IntegrationSetting>) => {
    const response = await apiClient.post(`/settings/integrations/${type}/test`, data || {});
    return response.data;
  },

  getMessageLogs: async (params: MessageLogsParams = {}) => {
    const response = await apiClient.get('/settings/message-logs', { params });
    return response.data;
  },

  getEmailLimitLogs: async (page = 1, limit = 20) => {
    const response = await apiClient.get('/settings/email-limit-logs', { params: { page, limit } });
    return response.data;
  },
};
