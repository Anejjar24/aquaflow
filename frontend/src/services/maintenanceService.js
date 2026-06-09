import apiClient from './apiClient';

export const maintenanceService = {
  async getMaintenance(params = {}) {
    const response = await apiClient.get('/maintenance', { params });
    return response.data;
  },

  async createMaintenance(payload) {
    const response = await apiClient.post('/maintenance', payload);
    return response.data;
  },

  async updateMaintenance(id, payload) {
    const response = await apiClient.patch(`/maintenance/${id}`, payload);
    return response.data;
  },

  async deleteMaintenance(id) {
    const response = await apiClient.delete(`/maintenance/${id}`);
    return response.data;
  },
};

export default maintenanceService;
