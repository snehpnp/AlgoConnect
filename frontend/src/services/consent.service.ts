import { apiClient } from './apiClient';

export interface Consent {
  id: number;
  leadId: number;
  channel: string;
  status: string;
}

export interface LeadWithConsents {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  consents: Consent[];
}

export const consentService = {
  getConsents: async (params?: { search?: string; page?: number; limit?: number; dncFilter?: string; typeFilter?: string; consentFilter?: string }) => {
    const response = await apiClient.get('/consents', { params });
    return response.data as { data: LeadWithConsents[], pagination: { total: number; page: number; limit: number; totalPages: number } };
  },

  updateConsent: async (leadId: number, channel: string, status: string) => {
    const response = await apiClient.post(`/consents/${leadId}`, { channel, status });
    return response.data;
  }
};
