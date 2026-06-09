import apiClient from './apiClient';

export const sensorService = {
  async getSensors(params = {}) {
    const response = await apiClient.get('/sensors', { params });
    return response.data;
  },

  async getSensorById(id) {
    const response = await apiClient.get(`/sensors/${id}`);
    return response.data;
  },

  async createSensor(payload) {
    const response = await apiClient.post('/sensors', payload);
    return response.data;
  },

  async updateSensor(id, payload) {
    const response = await apiClient.patch(`/sensors/${id}`, payload);
    return response.data;
  },

  async deleteSensor(id) {
    const response = await apiClient.delete(`/sensors/${id}`);
    return response.data;
  },

  async getSensorData(id, limit = 100) {
    const response = await apiClient.get(`/sensors/${id}/data`, { params: { limit } });
    return response.data;
  },

  async exportSensorDataCsv(id, params = {}) {
    const response = await apiClient.get(`/sensors/${id}/data/export`, {
      params,
      responseType: 'blob',
    });
    return response.data; // Blob
  },
};

export default sensorService;
