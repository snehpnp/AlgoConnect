import { apiClient } from './apiClient';

export interface Campaign {
  id: number;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetCampaignsResponse {
  message: string;
  data: Campaign[];
}

export const campaignService = {
  getCampaigns: async (): Promise<GetCampaignsResponse> => {
    const response = await apiClient.get<GetCampaignsResponse>('/campaigns');
    return response.data;
  },
};
