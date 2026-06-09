import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import dashboardReducer from './slices/dashboardSlice';
import realtimeReducer from './slices/realtimeSlice';
import stationsReducer from './slices/stationsSlice';
import sensorsReducer from './slices/sensorsSlice';
import alertsReducer from './slices/alertsSlice';
import maintenanceReducer from './slices/maintenanceSlice';
import uiReducer from './slices/uiSlice';
import notificationsReducer from './slices/notificationsSlice';
import usersReducer from './slices/usersSlice';
import analyticsReducer from './slices/analyticsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    dashboard: dashboardReducer,
    realtime: realtimeReducer,
    stations: stationsReducer,
    sensors: sensorsReducer,
    alerts: alertsReducer,
    maintenance: maintenanceReducer,
    ui: uiReducer,
    notifications: notificationsReducer,
    users: usersReducer,
    analytics: analyticsReducer,
  },
});

export default store;
