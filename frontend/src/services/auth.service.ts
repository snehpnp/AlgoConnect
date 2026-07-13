import { apiClient } from './apiClient';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar?: string | null;
  };
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },
  
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
  
  me: async (): Promise<{ user: LoginResponse['user'] }> => {
    const response = await apiClient.get<{ user: LoginResponse['user'] }>('/auth/me');
    return response.data;
  }
};
