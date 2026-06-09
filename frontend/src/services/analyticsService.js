import apiClient from './apiClient';

export const analyticsService = {
  // ── Existing ──────────────────────────────────────────────────────────────

  async getOverview() {
    const response = await apiClient.get('/analytics/overview');
    return response.data;
  },

  async getSensorStats(sensorId, params = {}) {
    const response = await apiClient.get(`/analytics/sensors/${sensorId}/stats`, { params });
    return response.data;
  },

  async getStationHistory(stationId, params = {}) {
    const response = await apiClient.get(`/analytics/stations/${stationId}/history`, { params });
    return response.data;
  },

  async getKpis(params = {}) {
    const response = await apiClient.get('/analytics/kpis', { params });
    return response.data;
  },

  async getSystemMetrics(hours = 24) {
    const response = await apiClient.get('/analytics/system-metrics', { params: { hours } });
    return response.data;
  },

  // ── New (Task 1 backend) ───────────────────────────────────────────────────

  /** Per-station health: sensor counts by status, open alerts, last reading. */
  async getStationStatus() {
    const response = await apiClient.get('/analytics/station-status');
    return response.data;
  },

  /**
   * Recent anomaly / threshold-violation alerts with station + sensor context.
   * @param {number} hours  Look-back window (default 24)
   * @param {number} limit  Max rows (default 100)
   */
  async getAnomalyTimeline(hours = 24, limit = 100) {
    const response = await apiClient.get('/analytics/anomaly-timeline', {
      params: { hours, limit },
    });
    return response.data;
  },

  /**
   * Hourly-bucketed average reading across all sensors for the last N hours.
   * Drives the 6h trend chart on Tab 1.
   */
  async getNetworkTrend(hours = 6) {
    const response = await apiClient.get('/analytics/network-trend', { params: { hours } });
    return response.data;
  },

  /**
   * Business-framed monitoring status: lastReadingAt, totalMeasurements, etc.
   * No Kafka/consumer language.
   */
  async getDataFreshness() {
    const response = await apiClient.get('/analytics/data-freshness');
    return response.data;
  },
};

export default analyticsService;
