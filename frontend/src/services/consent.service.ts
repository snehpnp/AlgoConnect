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
  getConsents: async (search?: string) => {
    const token = localStorage.getItem('algoconnect_token');
    const response = await axios.get(API_URL, {
      params: { search },
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data as LeadWithConsents[];
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
