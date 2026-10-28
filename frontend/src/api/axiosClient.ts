import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor - attach access token
axiosClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - auto refresh on 401
let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // Public auth failures (especially incorrect credentials) cannot be fixed
    // by refreshing a session. Preserve the endpoint's own error for the form.
    const isPublicAuthRequest = /(?:^|\/)auth\/(?:login|register|refresh|forgot-password|reset-password)(?:[/?#]|$)/.test(originalRequest?.url || '');

    if (originalRequest && error.response?.status === 401 && !originalRequest._retry && !isPublicAuthRequest) {
      originalRequest._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(axiosClient(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        );

        const newToken = data.accessToken;
        useAuthStore.getState().setTokens(newToken, data.refreshToken || refreshToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
