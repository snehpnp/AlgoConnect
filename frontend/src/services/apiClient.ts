import axios from 'axios';

export const base_url = window.location.hostname === "localhost" ? `http://localhost:7700/api` : `${window.location.origin}/backend/api`;

export const apiClient = axios.create({
  baseURL: base_url,
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
