import { apiClient } from './apiClient';

export interface MessageTemplate {
  id: number;
  name: string;
  content: string;
  type: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export const getTemplates = async () => {
  const response = await apiClient.get('/templates');
  return response.data;
};

export const getTemplateById = async (id: number) => {
  const response = await apiClient.get(`/templates/${id}`);
  return response.data;
};

export const createTemplate = async (data: Partial<MessageTemplate>) => {
  const response = await apiClient.post('/templates', data);
  return response.data;
};

export const updateTemplate = async (id: number, data: Partial<MessageTemplate>) => {
  const response = await apiClient.put(`/templates/${id}`, data);
  return response.data;
};

export const deleteTemplate = async (id: number) => {
  const response = await apiClient.delete(`/templates/${id}`);
  return response.data;
};
