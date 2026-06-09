import apiClient from './apiClient';

export const userService = {
  /**
   * Paginated list for management table (admin use).
   * Params: page, limit, role, search, isActive
   */
  async getUsers(params = {}) {
    const response = await apiClient.get('/users', { params });
    return response.data; // { data: [...], meta: { total, page, limit, pages } }
  },

  /**
   * Flat array for select/dropdown inputs — active users only.
   * @param {string} [role] - filter by role ('technician', 'operator', etc.)
   */
  async getUsersDropdown(role) {
    const params = { dropdown: 'true' };
    if (role) params.role = role;
    const response = await apiClient.get('/users', { params });
    return response.data; // plain array
  },

  async getUserById(id) {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  async updateUser(id, payload) {
    const response = await apiClient.patch(`/users/${id}`, payload);
    return response.data;
  },

  async updateProfile(payload) {
    const response = await apiClient.patch('/auth/profile', payload);
    return response.data;
  },
};

export default userService;
