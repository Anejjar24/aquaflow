import apiClient from './apiClient';

export const notificationService = {
  async getNotifications(params = {}) {
    const response = await apiClient.get('/notifications', { params });
    return response.data;
  },

  async getUnreadCount() {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data;
  },

  async markRead(id) {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllRead() {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data;
  },
};

export default notificationService;
