import { apiClient } from './apiClient';

export interface Campaign {
  id: number;
  name: string;
  description?: string | null;
  type: string;
  channels?: string[] | null;
  schedule?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  segmentId?: number | null;
  segment?: { id: number; name: string } | null;
  segmentIds?: number[];
  segments?: { id: number; name: string }[];
  emailTemplateId?: number | null;
  whatsappTemplateId?: number | null;
  smsTemplateId?: number | null;
  leads?: { id: number; name: string; email?: string | null; phone?: string | null }[];
  _count?: { leads: number };
}

export interface GetCampaignsResponse {
  message: string;
  data: Campaign[];
}

export const campaignService = {
  getCampaigns: async (): Promise<{ data: Campaign[] }> => {
    const response = await apiClient.get<{ data: Campaign[] }>('/campaigns');
    return response.data;
  },

  getCampaignById: async (id: number): Promise<{ data: Campaign }> => {
    const response = await apiClient.get<{ data: Campaign }>(`/campaigns/${id}`);
    return response.data;
  },

  createCampaign: async (campaign: Partial<Campaign>): Promise<{ data: Campaign }> => {
    const response = await apiClient.post<{ data: Campaign }>('/campaigns', campaign);
    return response.data;
  },

  updateCampaign: async (id: number, campaign: Partial<Campaign>): Promise<{ data: Campaign }> => {
    const response = await apiClient.put<{ data: Campaign }>(`/campaigns/${id}`, campaign);
    return response.data;
  },

  deleteCampaign: async (id: number): Promise<void> => {
    await apiClient.delete(`/campaigns/${id}`);
  },

  addLeadsToCampaign: async (id: number, leadIds: number[]): Promise<{ data: Campaign }> => {
    const response = await apiClient.post<{ data: Campaign }>(`/campaigns/${id}/leads`, { leadIds });
    return response.data;
  },

  getCampaignStats: async (id: number): Promise<{ data: { sends: any[], engagements: any[] } }> => {
    const response = await apiClient.get<{ data: { sends: any[], engagements: any[] } }>(`/campaigns/${id}/stats`);
    return response.data;
  },

  getCampaignLogs: async (id: number, page: number = 1, limit: number = 10): Promise<any> => {
    const response = await apiClient.get(`/campaigns/${id}/logs?page=${page}&limit=${limit}`);
    return response.data;
  },

  getCampaignLogDetail: async (campaignId: number, logId: number): Promise<any> => {
    const response = await apiClient.get(`/campaigns/${campaignId}/logs/${logId}`);
    return response.data;
  },

  sendManualMessage: async (id: number, data: { leadId: number; channel: string; templateId?: number; message?: string }): Promise<any> => {
    const response = await apiClient.post(`/campaigns/${id}/manual-message`, data);
    return response.data;
  },

  getEngineStatus: async (): Promise<{ data: { isRunning: boolean } }> => {
    const response = await apiClient.get<{ data: { isRunning: boolean } }>('/campaigns/engine/status');
    return response.data;
  },

  toggleEngineStatus: async (isRunning: boolean): Promise<{ data: { isRunning: boolean } }> => {
    const response = await apiClient.post<{ data: { isRunning: boolean } }>('/campaigns/engine/toggle', { isRunning });
    return response.data;
  }
};
