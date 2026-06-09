import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { maintenanceService } from '../../services/maintenanceService';

const initialState = {
  items: [],
  meta: { total: 0, page: 1, limit: 20, pages: 0 },
  isLoading: false,
  isSaving: false,
  error: null,
};

export const fetchMaintenance = createAsyncThunk('maintenance/fetchMaintenance', async (params = {}, { rejectWithValue }) => {
  try {
    return await maintenanceService.getMaintenance(params);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to load maintenance');
  }
});

export const createMaintenance = createAsyncThunk('maintenance/createMaintenance', async (payload, { rejectWithValue }) => {
  try {
    return await maintenanceService.createMaintenance(payload);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to create maintenance');
  }
});

export const updateMaintenance = createAsyncThunk('maintenance/updateMaintenance', async ({ id, payload }, { rejectWithValue }) => {
  try {
    return await maintenanceService.updateMaintenance(id, payload);
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to update maintenance');
  }
});

export const deleteMaintenance = createAsyncThunk('maintenance/deleteMaintenance', async (id, { rejectWithValue }) => {
  try {
    await maintenanceService.deleteMaintenance(id);
    return id;
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Failed to delete maintenance');
  }
});

const maintenanceSlice = createSlice({
  name: 'maintenance',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMaintenance.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMaintenance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data || [];
        state.meta = action.payload.meta || initialState.meta;
      })
      .addCase(fetchMaintenance.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createMaintenance.pending, (state) => { state.isSaving = true; })
      .addCase(createMaintenance.fulfilled, (state, action) => {
        state.isSaving = false;
        state.items.unshift(action.payload);
        state.meta.total += 1;
      })
      .addCase(createMaintenance.rejected, (state) => { state.isSaving = false; })
      .addCase(updateMaintenance.pending, (state) => { state.isSaving = true; })
      .addCase(updateMaintenance.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
      })
      .addCase(updateMaintenance.rejected, (state) => { state.isSaving = false; })
      .addCase(deleteMaintenance.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.meta.total -= 1;
      });
  },
});

export const selectMaintenanceItems = (state) => state.maintenance.items;
export const selectMaintenanceLoading = (state) => state.maintenance.isLoading;
export const selectMaintenanceSaving = (state) => state.maintenance.isSaving;
export const selectMaintenanceError = (state) => state.maintenance.error;
export const selectMaintenanceMeta = (state) => state.maintenance.meta;
export default maintenanceSlice.reducer;
