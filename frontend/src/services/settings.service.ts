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

  updateIntegration: async (type: string, data: Partial<IntegrationSetting>) => {
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
};

