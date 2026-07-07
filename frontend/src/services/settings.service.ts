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
};
