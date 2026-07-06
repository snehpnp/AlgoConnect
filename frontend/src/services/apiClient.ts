import axios from 'axios';

// Base URL from Vite env or fallback to localhost
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7700/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// --- Request Interceptor: attach JWT token from localStorage ---
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('algoconnect_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor: handle 401 globally ---
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stale session and redirect to login
      localStorage.removeItem('algoconnect_token');
      localStorage.removeItem('algoconnect_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
