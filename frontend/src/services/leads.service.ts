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
  status?: 'NEW' | 'CONTACTED' | 'CONVERTED' | string;
  salesStage: string;
  verificationStatus: string;
  engagementStatus: string;
  consentStatus: string;
  registrationNo?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  fax?: string | null;
  validity?: string | null;
  exchangeName?: string | null;
  tradeName?: string | null;
  userId: number | null;
  user?: { id: number; name: string } | null;
  leadScore?: number;
  createdAt: string;
  updatedAt: string;

  // Follow-Up fields
  nextFollowUpAt?: string | null;
  followUpNotes?: string | null;
  lastContactedAt?: string | null;
  
  // Enrichment fields
  isEnriched?: boolean;
  website?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  servicesSummary?: string | null;
  productsOffered?: string | null;
  sellsAlgoTrading?: string | null;
  brokerPartner?: string | null;
  companySizeEstimate?: string | null;
  enrichmentNotes?: string | null;
  logoUrl?: string | null;
  otherListings?: string | null;
}

export const getUnifiedStatus = (lead: Lead): string => {
  return lead.status || 'UNVERIFIED';
};

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
  fax?: string;
  validity?: string;
  exchangeName?: string;
  tradeName?: string;
}

export interface ImportLeadsResponse {
  message: string;
  count: number;
}

export const leadsService = {
  getLeads: async (params?: { page?: number; limit?: number; search?: string; salesStage?: string; verificationStatus?: string; engagementStatus?: string; consentStatus?: string; unifiedStatus?: string; type?: string; sortBy?: string; order?: 'asc' | 'desc'; state?: string; city?: string; websiteStatus?: string }): Promise<GetLeadsResponse> => {
    const response = await apiClient.get<GetLeadsResponse>('/leads', { params });
    return response.data;
  },

  getLeadById: async (id: number): Promise<{ message: string; data: Lead }> => {
    const response = await apiClient.get<{ message: string; data: Lead }>(`/leads/${id}`);
    return response.data;
  },

  getFilterOptions: async (state?: string): Promise<{ states: string[]; cities: string[]; types: string[] }> => {
    const response = await apiClient.get<{ message: string; data: { states: string[]; cities: string[]; types: string[] } }>('/leads/filters/options', {
      params: { state }
    });
    return response.data.data;
  },

  importLeads: async (leads: Partial<Lead>[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post<{ message: string; count: number }>('/leads/import', { leads });
    return response.data;
  },

  uploadChunk: async (formData: FormData): Promise<{ message: string; filename?: string }> => {
    const response = await apiClient.post('/leads/upload-chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  processFile: async (payload: { filename: string; entityType: string; mappings: any }): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/leads/process-file', payload);
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
  },

  sendDirectEmail: async (id: number, data: { subject?: string; body: string; templateId?: number; recipientEmail?: string }) => {
    const response = await apiClient.post(`/leads/${id}/send-email`, data);
    return response.data;
  },
};
