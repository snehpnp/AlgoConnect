import { apiClient } from './apiClient';

export interface WhatsAppStatus {
  connected: boolean;
  qrCode: string | null;
  account?: { name: string; number: string; pushname: string } | null;
}

export const whatsappService = {
  getStatus: async (): Promise<WhatsAppStatus> => {
    const response = await apiClient.get('/whatsapp/status');
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/whatsapp/logout');
    return response.data;
  }
};
