import apiClient from './apiClient';

export const alertService = {
  async getAlerts(params = {}) {
    const response = await apiClient.get('/alerts', { params });
    return response.data;
  },

  async createAlert(payload) {
    const response = await apiClient.post('/alerts', payload);
    return response.data;
  },

  async acknowledgeAlert(id) {
    const response = await apiClient.patch(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  async resolveAlert(id) {
    const response = await apiClient.patch(`/alerts/${id}/resolve`);
    return response.data;
  },

  async exportCsv(params = {}) {
    const response = await apiClient.get('/alerts/export/csv', {
      params,
      responseType: 'blob',
    });
    return response.data; // Blob
  },
};

export default alertService;
