import { apiClient } from './apiClient';

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  unverifiedLeads: number;
  activeLeads: number;
  engagedLeads: number;
  activeCampaigns: number;
}

export interface MonthlyAnalytics {
  label: string;
  value: string;
}

export interface Activity {
  id: number;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface DashboardResponse {
  message: string;
  data: {
    stats: DashboardStats;
    leadTypes: { type: string, count: number }[];
    analytics: MonthlyAnalytics[];
    activities: Activity[];
  };
}

export const dashboardService = {
  getStats: async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/dashboard/stats');
    return response.data;
  },
};
