import axios from 'axios';

const defaultServerUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL || defaultServerUrl).replace(/\/$/, '');

const api = axios.create({ baseURL: `${SERVER_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
