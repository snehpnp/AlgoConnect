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

export interface CommunicationEvent {
  id: number;
  channel: string;
  eventType: string;
  details: string | null;
  createdAt: string;
  lead: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  };
  campaign: {
    id: number;
    name: string;
    type: string;
  } | null;
}

export interface DashboardResponse {
  message: string;
  data: {
    stats: DashboardStats;
    leadTypes: { type: string, count: number, wonCount: number, winRate: number }[];
    leadsByStatus: { status: string, count: number }[];
    analytics: MonthlyAnalytics[];
    activities: Activity[];
    recentCommunications?: CommunicationEvent[];
    leaderboard?: {
      id: number;
      name: string;
      avatar: string | null;
      totalLeads: number;
      wonLeads: number;
      activities: number;
      score: number;
    }[];
    topCampaigns?: {
      id: number;
      name: string;
      type: string;
      totalSent: number;
      successCount: number;
      conversionRate: number;
    }[];
    averageTimeToClose?: number;
  };
}

export const dashboardService = {
  getStats: async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/dashboard/stats');
    return response.data;
  },
};
