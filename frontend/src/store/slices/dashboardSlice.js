import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  kpis: [
    { id: 'stations', label: 'Active Stations', value: 12, unit: '', trend: '+2', status: 'normal', icon: 'ni ni-building' },
    { id: 'pressure', label: 'Avg Pressure', value: 4.8, unit: 'bar', trend: '-0.2', status: 'warning', icon: 'ni ni-sound-wave' },
    { id: 'flow', label: 'Total Flow', value: 1860, unit: 'm3/h', trend: '+7%', status: 'normal', icon: 'ni ni-delivery-fast' },
    { id: 'alerts', label: 'Active Alerts', value: 5, unit: '', trend: '+1', status: 'critical', icon: 'ni ni-bell-55' },
  ],
  alerts: [
    { id: 'ALT-1042', station: 'North Intake Station', severity: 'critical', message: 'Pressure exceeds threshold on pump line A', time: '2 min ago' },
    { id: 'ALT-1038', station: 'Reservoir East', severity: 'high', message: 'Turbidity reading requires operator review', time: '12 min ago' },
    { id: 'ALT-1031', station: 'Distribution Zone 3', severity: 'medium', message: 'Flow deviation detected against daily baseline', time: '28 min ago' },
  ],
  stations: [
    { id: 'ST-001', name: 'North Intake Station', region: 'Casablanca North', status: 'critical', pressure: 6.7, flow: 420, sensorsOnline: 18, sensorsTotal: 20 },
    { id: 'ST-002', name: 'Reservoir East', region: 'Ain Sebaa', status: 'warning', pressure: 4.3, flow: 310, sensorsOnline: 14, sensorsTotal: 15 },
    { id: 'ST-003', name: 'Treatment Plant A', region: 'Mediouna', status: 'normal', pressure: 4.9, flow: 680, sensorsOnline: 32, sensorsTotal: 32 },
    { id: 'ST-004', name: 'Distribution Zone 3', region: 'Hay Hassani', status: 'normal', pressure: 4.1, flow: 450, sensorsOnline: 22, sensorsTotal: 24 },
  ],
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    applySensorUpdate: (state, action) => {
      const { stationId, pressure, flow } = action.payload || {};
      const station = state.stations.find((item) => item.id === stationId);
      if (station) {
        if (typeof pressure === 'number') station.pressure = pressure;
        if (typeof flow === 'number') station.flow = flow;
      }
    },
    addDashboardAlert: (state, action) => {
      const alert = action.payload || {};
      state.alerts.unshift({
        id: alert.id || alert.alertId || `ALT-${Date.now()}`,
        station: alert.station || alert.stationName || 'Workflow automation',
        severity: alert.severity || 'medium',
        message: alert.message || 'New realtime alert received',
        time: 'Just now',
      });
      state.alerts = state.alerts.slice(0, 8);
      const activeAlerts = state.kpis.find((kpi) => kpi.id === 'alerts');
      if (activeAlerts) activeAlerts.value += 1;
    },
    updateStationStatus: (state, action) => {
      const { stationId, status } = action.payload || {};
      const station = state.stations.find((item) => item.id === stationId);
      if (station && status) station.status = status;
    },
  },
});

export const { applySensorUpdate, addDashboardAlert, updateStationStatus } = dashboardSlice.actions;

export const selectDashboardKpis = (state) => state.dashboard.kpis;
export const selectDashboardAlerts = (state) => state.dashboard.alerts;
export const selectDashboardStations = (state) => state.dashboard.stations;

export default dashboardSlice.reducer;
