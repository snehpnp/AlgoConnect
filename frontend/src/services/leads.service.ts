import { apiClient } from './apiClient';

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  source: string | null;
  type: string;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED';
  registrationNo?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  userId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetLeadsResponse {
  message: string;
  data: Lead[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ImportLeadInput {
  name: string;
  email?: string;
  email2?: string;
  phone?: string;
  phone2?: string;
  source?: string;
  type?: string;
  registrationNo?: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface ImportLeadsResponse {
  message: string;
  count: number;
}

export const leadsService = {
  getLeads: async (params?: { page?: number; limit?: number; search?: string; salesStage?: string; verificationStatus?: string; engagementStatus?: string; consentStatus?: string; type?: string }): Promise<GetLeadsResponse> => {
    const response = await apiClient.get<GetLeadsResponse>('/leads', { params });
    return response.data;
  },

  importLeads: async (leads: Partial<Lead>[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post<{ message: string; count: number }>('/leads/import', { leads });
    return response.data;
  },

  createLead: async (lead: Partial<Lead>): Promise<Lead> => {
    const response = await apiClient.post<{ message: string; data: Lead }>('/leads', lead);
    return response.data.data;
  },

  updateLead: async (id: number, lead: Partial<Lead>): Promise<Lead> => {
    const response = await apiClient.put<{ message: string; data: Lead }>(`/leads/${id}`, lead);
    return response.data.data;
  },

  deleteLead: async (id: number): Promise<void> => {
    await apiClient.delete(`/leads/${id}`);
  },

  getLeadLogs: async (id: number): Promise<any[]> => {
    const response = await apiClient.get<{ message: string; data: any[] }>(`/leads/${id}/logs`);
    return response.data.data;
  }
};
