import { apiClient } from './apiClient';

export interface CampaignAutomation {
  id: number;
  name: string;
  campaignId: number;
  trigger: string;
  waitTime: number | null;
  condition: string | null;
  action: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const automationService = {
  getAutomations: async (campaignId?: number): Promise<{ data: CampaignAutomation[] }> => {
    const url = campaignId ? `/automations?campaignId=${campaignId}` : '/automations';
    const response = await apiClient.get<{ data: CampaignAutomation[] }>(url);
    return response.data;
  },

  createAutomation: async (automation: Partial<CampaignAutomation>): Promise<{ data: CampaignAutomation }> => {
    const response = await apiClient.post<{ data: CampaignAutomation }>('/automations', automation);
    return response.data;
  },

  updateAutomation: async (id: number, automation: Partial<CampaignAutomation>): Promise<{ data: CampaignAutomation }> => {
    const response = await apiClient.put<{ data: CampaignAutomation }>(`/automations/${id}`, automation);
    return response.data;
  },

  deleteAutomation: async (id: number): Promise<void> => {
    await apiClient.delete(`/automations/${id}`);
  }
};
