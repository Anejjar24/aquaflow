/**
 * simulator.api.js
 * Thin API layer for the Sensor Simulation Lab.
 * Re-uses the main apiClient (Axios + JWT interceptors).
 */
import apiClient from '../../services/apiClient';

/**
 * Fetch all stations (for the selector dropdown).
 */
export async function fetchStations() {
  const res = await apiClient.get('/stations', { params: { limit: 100 } });
  return res.data?.data ?? res.data ?? [];
}

/**
 * Fetch sensors for a given station.
 */
export async function fetchSensorsByStation(stationId) {
  const res = await apiClient.get('/sensors', {
    params: { stationId, limit: 100 },
  });
  return res.data?.data ?? res.data ?? [];
}

/**
 * Fetch a single sensor with full metadata (thresholds, station, alerts).
 */
export async function fetchSensor(sensorId) {
  const res = await apiClient.get(`/sensors/${sensorId}`);
  return res.data;
}

/**
 * Inject a manual sensor reading.
 * Maps to POST /sensors/:id/reading  → SensorsController.injectReading()
 * The backend persists a SensorData record, updates lastReading,
 * and now also emits a "sensor-update" Socket.IO event.
 */
export async function injectSensorReading(sensorId, value) {
  const res = await apiClient.post(`/sensors/${sensorId}/reading`, { value });
  return res.data;
}
