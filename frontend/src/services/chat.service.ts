import { apiClient } from './apiClient';

export const chatService = {
  async sendMessage(message: string): Promise<string> {
    try {
      const response = await apiClient.post('/chat', { message });
      return response.data.response;
    } catch (error) {
      console.error('Chat API Error:', error);
      throw new Error('Failed to get a response from the AI assistant.');
    }
  }
};
