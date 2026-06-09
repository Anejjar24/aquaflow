import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { stationService } from '../../services/stationService';

const initialState = {
  items: [],
  selectedStation: null,
  meta: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0,
  },
  filters: {
    status: '',
    type: '',
    search: '',
  },
  isLoading: false,
  isSaving: false,
  error: null,
};

export const fetchStations = createAsyncThunk(
  'stations/fetchStations',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { stations } = getState();
      const query = {
        ...stations.filters,
        ...params,
      };
      Object.keys(query).forEach((key) => {
        if (query[key] === '' || query[key] === undefined || query[key] === null) {
          delete query[key];
        }
      });
      return await stationService.getStations(query);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load stations');
    }
  }
);

export const createStation = createAsyncThunk(
  'stations/createStation',
  async (payload, { rejectWithValue }) => {
    try {
      return await stationService.createStation(payload);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create station');
    }
  }
);

export const updateStation = createAsyncThunk(
  'stations/updateStation',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      return await stationService.updateStation(id, payload);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update station');
    }
  }
);

export const deleteStation = createAsyncThunk(
  'stations/deleteStation',
  async (id, { rejectWithValue }) => {
    try {
      return await stationService.deleteStation(id);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete station');
    }
  }
);

const stationsSlice = createSlice({
  name: 'stations',
  initialState,
  reducers: {
    setStationFilters: (state, action) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
    },
    clearStationsError: (state) => {
      state.error = null;
    },
    stationRealtimeUpdated: (state, action) => {
      const { stationId, status, name } = action.payload || {};
      const idx = state.items.findIndex((s) => s.id === stationId);
      if (idx >= 0) {
        if (status) state.items[idx].status = status;
        if (name) state.items[idx].name = name;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data || [];
        state.meta = action.payload.meta || initialState.meta;
      })
      .addCase(fetchStations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(createStation.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createStation.fulfilled, (state, action) => {
        state.isSaving = false;
        state.items.unshift(action.payload);
        state.meta.total += 1;
      })
      .addCase(createStation.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })
      .addCase(updateStation.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateStation.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.items.findIndex((station) => station.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        if (state.selectedStation?.id === action.payload.id) {
          state.selectedStation = action.payload;
        }
      })
      .addCase(updateStation.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })
      .addCase(deleteStation.fulfilled, (state, action) => {
        state.items = state.items.filter((station) => station.id !== action.payload);
        state.meta.total = Math.max(0, state.meta.total - 1);
      })
      .addCase(deleteStation.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearStationsError, setStationFilters, stationRealtimeUpdated } = stationsSlice.actions;

export const selectStations = (state) => state.stations.items;
export const selectStationsMeta = (state) => state.stations.meta;
export const selectStationsFilters = (state) => state.stations.filters;
export const selectStationsLoading = (state) => state.stations.isLoading;
export const selectStationsSaving = (state) => state.stations.isSaving;
export const selectStationsError = (state) => state.stations.error;

export default stationsSlice.reducer;
