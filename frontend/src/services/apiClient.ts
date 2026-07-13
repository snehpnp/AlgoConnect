import axios from 'axios';

export const base_url = window.location.hostname === "localhost" ? `http://localhost:7701/api` : `${window.location.origin}/backend1/api`;

export const apiClient = axios.create({
  baseURL: base_url,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true,
});

// --- Request Interceptor: Attach credentials if not using cookie-parser automatically (it's automatic for cookies) ---
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor: handle 401 globally ---
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect if it's NOT the login endpoint and not the me endpoint
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    const isMeEndpoint = error.config?.url?.includes('/auth/me');
    
    if (error.response?.status === 401 && !isLoginEndpoint && !isMeEndpoint) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
