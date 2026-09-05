import { apiClient } from './apiClient';

export interface User {
  id: number;
  name: string;
  email: string;
  roleId: number;
  role: { id: number; name: string };
  createdAt: string;
}

export const usersService = {
  getUsers: async (): Promise<{ message: string; data: User[] }> => {
    const response = await apiClient.get<{ message: string; data: User[] }>('/users');
    return response.data;
  },
};
