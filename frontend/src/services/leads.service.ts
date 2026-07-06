import { apiClient } from './apiClient';

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  email2: string | null;
  phone: string | null;
  phone2: string | null;
  source: string | null;
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
  getLeads: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<GetLeadsResponse> => {
    const response = await apiClient.get<GetLeadsResponse>('/leads', { params });
    return response.data;
  },

  importLeads: async (leads: ImportLeadInput[]): Promise<ImportLeadsResponse> => {
    const response = await apiClient.post<ImportLeadsResponse>('/leads/import', { leads });
    return response.data;
  },

  createLead: async (lead: ImportLeadInput): Promise<{ message: string; data: Lead }> => {
    const response = await apiClient.post<{ message: string; data: Lead }>('/leads', lead);
    return response.data;
  },

  updateLead: async (id: number, lead: Partial<ImportLeadInput>): Promise<{ message: string; data: Lead }> => {
    const response = await apiClient.put<{ message: string; data: Lead }>(`/leads/${id}`, lead);
    return response.data;
  },
};
