import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { analyticsService } from '../../services/analyticsService';
import { sensorService } from '../../services/sensorService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rejectMsg = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;

// ─── Async thunks ─────────────────────────────────────────────────────────────

export const fetchAnalyticsOverview = createAsyncThunk(
  'analytics/fetchOverview',
  async (_, { rejectWithValue }) => {
    try { return await analyticsService.getOverview(); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load overview')); }
  },
);

export const fetchAnalyticsSensors = createAsyncThunk(
  'analytics/fetchSensors',
  async () => {
    const res = await sensorService.getSensors({ limit: 200 });
    return res.data || res || [];
  },
);

export const fetchSensorStats = createAsyncThunk(
  'analytics/fetchSensorStats',
  async ({ sensorId, params }, { rejectWithValue }) => {
    try { return await analyticsService.getSensorStats(sensorId, params); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load sensor stats')); }
  },
);

// ── New: station status grid (Tab 1) ─────────────────────────────────────────

export const fetchStationStatus = createAsyncThunk(
  'analytics/fetchStationStatus',
  async (_, { rejectWithValue }) => {
    try { return await analyticsService.getStationStatus(); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load station status')); }
  },
);

// ── New: anomaly feed + scatter (Tab 2) ───────────────────────────────────────

export const fetchAnomalyTimeline = createAsyncThunk(
  'analytics/fetchAnomalyTimeline',
  async ({ hours = 24, limit = 100 } = {}, { rejectWithValue }) => {
    try { return await analyticsService.getAnomalyTimeline(hours, limit); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load anomaly data')); }
  },
);

// ── New: 6-hour trend chart (Tab 1) ───────────────────────────────────────────

export const fetchNetworkTrend = createAsyncThunk(
  'analytics/fetchNetworkTrend',
  async (hours = 6, { rejectWithValue }) => {
    try { return await analyticsService.getNetworkTrend(hours); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load network trend')); }
  },
);

// ── New: monitoring data freshness (Tab 1 banner) ─────────────────────────────

export const fetchDataFreshness = createAsyncThunk(
  'analytics/fetchDataFreshness',
  async (_, { rejectWithValue }) => {
    try { return await analyticsService.getDataFreshness(); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load data freshness')); }
  },
);

// ── Kept: Spark pre-computed KPIs (Tab 2 z-score table) ─────────────────────

export const fetchKpis = createAsyncThunk(
  'analytics/fetchKpis',
  async (params = {}, { rejectWithValue }) => {
    try { return await analyticsService.getKpis(params); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load KPIs')); }
  },
);

// ── Kept: measurement volume (Tab 3) ─────────────────────────────────────────

export const fetchSystemMetrics = createAsyncThunk(
  'analytics/fetchSystemMetrics',
  async (hours = 24, { rejectWithValue }) => {
    try { return await analyticsService.getSystemMetrics(hours); }
    catch (err) { return rejectWithValue(rejectMsg(err, 'Failed to load system metrics')); }
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    // Tab 1 — Overview
    overview:            null,
    overviewLoading:     false,
    overviewError:       null,
    stationStatus:       [],
    stationStatusLoading: false,
    networkTrend:        [],
    networkTrendLoading: false,
    dataFreshness:       null,
    dataFreshnessLoading: false,

    // Shared — sensor list for dropdowns
    sensors:             [],

    // Tab 2 — Anomalies
    anomalyTimeline:     [],
    anomalyLoading:      false,
    anomalyError:        null,
    kpis:                null,
    kpisLoading:         false,
    kpisError:           null,

    // Tab 3 — Trends & History
    systemMetrics:       null,
    systemMetricsLoading: false,

    // Tab 4 — Station Detail
    sensorStats:         null,
    statsLoading:        false,
    statsError:          null,
  },

  reducers: {
    clearSensorStats(state) {
      state.sensorStats = null;
      state.statsError  = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // ── Overview ────────────────────────────────────────────────────────────
      .addCase(fetchAnalyticsOverview.pending,   (s) => { s.overviewLoading = true;  s.overviewError = null; })
      .addCase(fetchAnalyticsOverview.fulfilled, (s, a) => { s.overviewLoading = false; s.overview = a.payload; })
      .addCase(fetchAnalyticsOverview.rejected,  (s, a) => { s.overviewLoading = false; s.overviewError = a.payload || a.error.message; })

      // ── Sensor list ─────────────────────────────────────────────────────────
      .addCase(fetchAnalyticsSensors.fulfilled, (s, a) => { s.sensors = a.payload; })

      // ── Station status grid ─────────────────────────────────────────────────
      .addCase(fetchStationStatus.pending,   (s) => { s.stationStatusLoading = true; })
      .addCase(fetchStationStatus.fulfilled, (s, a) => { s.stationStatusLoading = false; s.stationStatus = a.payload; })
      .addCase(fetchStationStatus.rejected,  (s) => { s.stationStatusLoading = false; })

      // ── Network trend ───────────────────────────────────────────────────────
      .addCase(fetchNetworkTrend.pending,   (s) => { s.networkTrendLoading = true; })
      .addCase(fetchNetworkTrend.fulfilled, (s, a) => { s.networkTrendLoading = false; s.networkTrend = a.payload; })
      .addCase(fetchNetworkTrend.rejected,  (s) => { s.networkTrendLoading = false; })

      // ── Data freshness ──────────────────────────────────────────────────────
      .addCase(fetchDataFreshness.pending,   (s) => { s.dataFreshnessLoading = true; })
      .addCase(fetchDataFreshness.fulfilled, (s, a) => { s.dataFreshnessLoading = false; s.dataFreshness = a.payload; })
      .addCase(fetchDataFreshness.rejected,  (s) => { s.dataFreshnessLoading = false; })

      // ── Anomaly timeline ────────────────────────────────────────────────────
      .addCase(fetchAnomalyTimeline.pending,   (s) => { s.anomalyLoading = true;  s.anomalyError = null; })
      .addCase(fetchAnomalyTimeline.fulfilled, (s, a) => { s.anomalyLoading = false; s.anomalyTimeline = a.payload; })
      .addCase(fetchAnomalyTimeline.rejected,  (s, a) => { s.anomalyLoading = false; s.anomalyError = a.payload || a.error.message; })

      // ── KPIs (Spark aggregates) ─────────────────────────────────────────────
      .addCase(fetchKpis.pending,   (s) => { s.kpisLoading = true;  s.kpisError = null; })
      .addCase(fetchKpis.fulfilled, (s, a) => { s.kpisLoading = false; s.kpis = a.payload; })
      .addCase(fetchKpis.rejected,  (s, a) => { s.kpisLoading = false; s.kpisError = a.payload || a.error.message; })

      // ── System metrics ──────────────────────────────────────────────────────
      .addCase(fetchSystemMetrics.pending,   (s) => { s.systemMetricsLoading = true; })
      .addCase(fetchSystemMetrics.fulfilled, (s, a) => { s.systemMetricsLoading = false; s.systemMetrics = a.payload; })
      .addCase(fetchSystemMetrics.rejected,  (s) => { s.systemMetricsLoading = false; })

      // ── Sensor stats (Tab 4) ─────────────────────────────────────────────────
      .addCase(fetchSensorStats.pending,   (s) => { s.statsLoading = true;  s.statsError = null; s.sensorStats = null; })
      .addCase(fetchSensorStats.fulfilled, (s, a) => { s.statsLoading = false; s.sensorStats = a.payload; })
      .addCase(fetchSensorStats.rejected,  (s, a) => { s.statsLoading = false; s.statsError = a.payload || a.error.message; });
  },
});

export const { clearSensorStats } = analyticsSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────

// Tab 1 — Overview
export const selectAnalyticsOverview         = (s) => s.analytics.overview;
export const selectAnalyticsOverviewLoading  = (s) => s.analytics.overviewLoading;
export const selectAnalyticsOverviewError    = (s) => s.analytics.overviewError;
export const selectStationStatus             = (s) => s.analytics.stationStatus;
export const selectStationStatusLoading      = (s) => s.analytics.stationStatusLoading;
export const selectNetworkTrend              = (s) => s.analytics.networkTrend;
export const selectNetworkTrendLoading       = (s) => s.analytics.networkTrendLoading;
export const selectDataFreshness             = (s) => s.analytics.dataFreshness;

// Shared
export const selectAnalyticsSensors          = (s) => s.analytics.sensors;

// Tab 2 — Anomalies
export const selectAnomalyTimeline           = (s) => s.analytics.anomalyTimeline;
export const selectAnomalyLoading            = (s) => s.analytics.anomalyLoading;
export const selectAnomalyError              = (s) => s.analytics.anomalyError;
export const selectAnalyticsKpis             = (s) => s.analytics.kpis;
export const selectAnalyticsKpisLoading      = (s) => s.analytics.kpisLoading;

// Tab 3 — Trends
export const selectAnalyticsSystemMetrics    = (s) => s.analytics.systemMetrics;
export const selectSystemMetricsLoading      = (s) => s.analytics.systemMetricsLoading;

// Tab 4 — Station Detail
export const selectAnalyticsSensorStats      = (s) => s.analytics.sensorStats;
export const selectAnalyticsStatsLoading     = (s) => s.analytics.statsLoading;
export const selectAnalyticsStatsError       = (s) => s.analytics.statsError;

export default analyticsSlice.reducer;
