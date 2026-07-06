import { apiClient } from './apiClient';

export interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  pendingLeads: number;
  closedLeads: number;
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
