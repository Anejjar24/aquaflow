import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { alertService } from '../../services/alertService';

const initialState = {
  items: [],
  meta: { total: 0, page: 1, limit: 20, pages: 0 },
  isLoading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk('alerts/fetchAlerts', async (params = {}, { rejectWithValue }) => {
  try {
    return await alertService.getAlerts(params);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load alerts');
  }
});

export const acknowledgeAlert = createAsyncThunk('alerts/acknowledgeAlert', async (id, { rejectWithValue }) => {
  try {
    return await alertService.acknowledgeAlert(id);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to acknowledge alert');
  }
});

export const resolveAlert = createAsyncThunk('alerts/resolveAlert', async (id, { rejectWithValue }) => {
  try {
    return await alertService.resolveAlert(id);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to resolve alert');
  }
});

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    alertRealtimeReceived: (state, action) => {
      const alert = action.payload || {};
      state.items.unshift({
        id: alert.id || alert.alertId || `alert-${Date.now()}`,
        severity: alert.severity || 'warning',
        status: 'active',
        message: alert.message || 'New alert received',
        station: alert.station ? { name: alert.station } : null,
        createdAt: alert.timestamp || new Date().toISOString(),
      });
      state.items = state.items.slice(0, 50);
      state.meta.total += 1;
    },
  },
  extraReducers: (builder) => {
    const replaceAlert = (state, action) => {
      const index = state.items.findIndex((item) => item.id === action.payload.id);
      if (index >= 0) state.items[index] = action.payload;
    };

    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data || [];
        state.meta = action.payload.meta || initialState.meta;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(acknowledgeAlert.fulfilled, replaceAlert)
      .addCase(resolveAlert.fulfilled, replaceAlert);
  },
});

export const { alertRealtimeReceived } = alertsSlice.actions;
export const selectAlerts = (state) => state.alerts.items;
export const selectAlertsLoading = (state) => state.alerts.isLoading;
export const selectAlertsError = (state) => state.alerts.error;
export default alertsSlice.reducer;
