import apiClient from './apiClient';
import {
  clearAuthSession,
  getAccessToken,
  persistAuthSession,
} from './authSession';

export const authService = {
  async login(credentials) {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  async register(userData) {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Local session cleanup must still complete if the token is already expired.
    } finally {
      clearAuthSession('logout');
    }
  },

  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async refresh(refreshToken) {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  getAccessToken() {
    return getAccessToken();
  },

  setAccessToken(token) {
    if (token) {
      persistAuthSession({ accessToken: token });
    } else {
      clearAuthSession('access-token-cleared');
    }
  },

  setRefreshToken(token) {
    if (token) {
      persistAuthSession({ refreshToken: token });
    } else {
      clearAuthSession('refresh-token-cleared');
    }
  },

  isAuthenticated() {
    return !!this.getAccessToken();
  },

  clearTokens() {
    clearAuthSession('tokens-cleared');
  },
};
