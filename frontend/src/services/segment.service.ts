import axios from 'axios';

const API_URL = 'http://localhost:7700/api/segments';

export interface SegmentRule {
  entityType?: string;
  activityStatus?: string;
  region?: string;
  leadScore?: string;
  existingProduct?: string;
  market?: string;
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
    const response = await axios.post(API_URL, { name, description, rules });
    return response.data;
  },

  getSegments: async () => {
    const response = await axios.get(API_URL);
    return response.data.data;
  },

  previewSegment: async (rules: SegmentRule) => {
    const response = await axios.post(`${API_URL}/preview`, { rules });
    return response.data.data.count;
  },

  deleteSegment: async (id: number) => {
    const response = await axios.delete(`${API_URL}/${id}`);
    return response.data;
  }
};
