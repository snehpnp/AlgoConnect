import { apiClient } from './apiClient';

export interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  segmentId?: number | null;
  segment?: { id: number; name: string };
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
  }
};
