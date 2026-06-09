import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  lastSensorUpdate: null,
  lastAlert: null,
  events: [],
};

const pushEvent = (state, event) => {
  state.events.unshift({
    id: `${event.type}-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...event,
  });
  state.events = state.events.slice(0, 25);
};

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    socketConnected: (state) => {
      state.connected = true;
      state.lastConnectedAt = new Date().toISOString();
      pushEvent(state, { type: 'socket-connected', label: 'Realtime connected' });
    },
    socketDisconnected: (state) => {
      state.connected = false;
      state.lastDisconnectedAt = new Date().toISOString();
      pushEvent(state, { type: 'socket-disconnected', label: 'Realtime disconnected' });
    },
    sensorUpdateReceived: (state, action) => {
      state.lastSensorUpdate = action.payload;
      pushEvent(state, { type: 'sensor-update', label: 'Sensor update', payload: action.payload });
    },
    alertReceived: (state, action) => {
      state.lastAlert = action.payload;
      pushEvent(state, { type: 'alert-created', label: 'Alert created', payload: action.payload });
    },
    stationStatusReceived: (state, action) => {
      pushEvent(state, { type: 'station-status', label: 'Station status update', payload: action.payload });
    },
    resetRealtime: () => initialState,
  },
});

export const {
  socketConnected,
  socketDisconnected,
  sensorUpdateReceived,
  alertReceived,
  stationStatusReceived,
  resetRealtime,
} = realtimeSlice.actions;

export const selectRealtime = (state) => state.realtime;
export const selectRealtimeConnected = (state) => state.realtime.connected;
export const selectRealtimeEvents = (state) => state.realtime.events;

export default realtimeSlice.reducer;
