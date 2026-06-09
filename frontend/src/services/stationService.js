import apiClient from './apiClient';

export const stationService = {
  async getStations(params = {}) {
    const response = await apiClient.get('/stations', { params });
    return response.data;
  },

  async getStation(id) {
    const response = await apiClient.get(`/stations/${id}`);
    return response.data;
  },

  async createStation(payload) {
    const response = await apiClient.post('/stations', payload);
    return response.data;
  },

  async updateStation(id, payload) {
    const response = await apiClient.patch(`/stations/${id}`, payload);
    return response.data;
  },

  async deleteStation(id) {
    await apiClient.delete(`/stations/${id}`);
    return id;
  },
};

export default stationService;
