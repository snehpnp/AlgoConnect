import axios from 'axios';

const API_URL = 'http://localhost:7700/api/consents';

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
  consents: Consent[];
}

export const consentService = {
  getConsents: async (params?: { search?: string; page?: number; limit?: number; dncFilter?: string }) => {
    const token = localStorage.getItem('algoconnect_token');
    const response = await axios.get(API_URL, {
      params,
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data as { data: LeadWithConsents[], pagination: { total: number; page: number; limit: number; totalPages: number } };
  },

  updateConsent: async (leadId: number, channel: string, status: string) => {
    const token = localStorage.getItem('algoconnect_token');
    const response = await axios.post(`${API_URL}/${leadId}`, 
      { channel, status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  }
};
