import { apiClient } from './apiClient';

export interface SegmentRule {
  entityType?: string;
  activityStatus?: string;
  region?: string;
  city?: string;
  leadScore?: string;
  existingProduct?: string;
  market?: string;
  websiteStatus?: string;
  algoStatus?: string;
}

export interface Segment {
  id: number;
  name: string;
  description?: string;
  rules: SegmentRule;
  createdAt: string;
}

export const segmentService = {
  createSegment: async (name: string, description: string, rules: SegmentRule) => {
    const response = await apiClient.post('/segments', { name, description, rules });
    return response.data;
  },

  getSegments: async () => {
    const response = await apiClient.get('/segments');
    return response.data.data;
  },

  getSegmentLeads: async (id: number): Promise<any[]> => {
    const response = await apiClient.get(`/segments/${id}/leads`);
    return response.data.data;
  },

  previewSegment: async (rules: SegmentRule): Promise<{ count: number; leads: any[] }> => {
    const response = await apiClient.post('/segments/preview', { rules });
    return response.data.data;
  },

  deleteSegment: async (id: number) => {
    const response = await apiClient.delete(`/segments/${id}`);
    return response.data;
  }
};
