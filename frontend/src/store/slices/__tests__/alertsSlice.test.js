/**
 * Unit tests for alertsSlice reducers and selectors.
 *
 * Pure Redux logic tested in isolation — no network calls, no components.
 * Actions are fed directly into the reducer; assertions are on the resulting state.
 */

import alertsReducer, {
  alertRealtimeReceived,
  fetchAlerts,
  acknowledgeAlert,
  resolveAlert,
  selectAlerts,
  selectAlertsLoading,
  selectAlertsError,
} from '../alertsSlice';

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  items: [],
  meta: { total: 0, page: 1, limit: 20, pages: 0 },
  isLoading: false,
  error: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeAlert = (id = 'alert-1', overrides = {}) => ({
  id,
  severity: 'warning',
  status: 'active',
  message: 'High pressure detected',
  station: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ─── Reducer tests ────────────────────────────────────────────────────────────

describe('alertsSlice reducer', () => {
  it('returns the initial state', () => {
    expect(alertsReducer(undefined, { type: '@@INIT' })).toEqual(initialState);
  });

  // ── alertRealtimeReceived ────────────────────────────────────────────────

  describe('alertRealtimeReceived', () => {
    it('prepends the incoming alert to items', () => {
      const existing = makeAlert('a1');
      const incoming = { id: 'a2', severity: 'critical', message: 'Emergency' };
      const state = { ...initialState, items: [existing] };

      const next = alertsReducer(state, alertRealtimeReceived(incoming));

      expect(next.items[0].id).toBe('a2');
      expect(next.items[1].id).toBe('a1');
    });

    it('increments meta.total by 1', () => {
      const state = { ...initialState, meta: { ...initialState.meta, total: 3 } };
      const next = alertsReducer(state, alertRealtimeReceived({ id: 'a-new' }));
      expect(next.meta.total).toBe(4);
    });

    it('truncates items list to a maximum of 50 entries', () => {
      const items = Array.from({ length: 50 }, (_, i) => makeAlert(`a${i}`));
      const state = { ...initialState, items };

      const next = alertsReducer(state, alertRealtimeReceived({ id: 'overflow' }));

      expect(next.items).toHaveLength(50);
      expect(next.items[0].id).toBe('overflow');
    });

    it('uses alert.alertId as id fallback when alert.id is absent', () => {
      const next = alertsReducer(
        initialState,
        alertRealtimeReceived({ alertId: 'fallback-id', message: 'Test' }),
      );
      expect(next.items[0].id).toBe('fallback-id');
    });

    it('always sets status to "active"', () => {
      const next = alertsReducer(initialState, alertRealtimeReceived({ id: 'x' }));
      expect(next.items[0].status).toBe('active');
    });

    it('maps station string to { name } object', () => {
      const next = alertsReducer(
        initialState,
        alertRealtimeReceived({ id: 'x', station: 'Station Alpha' }),
      );
      expect(next.items[0].station).toEqual({ name: 'Station Alpha' });
    });

    it('sets station to null when station field is absent', () => {
      const next = alertsReducer(initialState, alertRealtimeReceived({ id: 'x' }));
      expect(next.items[0].station).toBeNull();
    });

    it('uses alert.timestamp as createdAt when provided', () => {
      const ts = '2024-06-01T12:00:00.000Z';
      const next = alertsReducer(
        initialState,
        alertRealtimeReceived({ id: 'x', timestamp: ts }),
      );
      expect(next.items[0].createdAt).toBe(ts);
    });
  });

  // ── fetchAlerts async thunk ──────────────────────────────────────────────

  describe('fetchAlerts thunk', () => {
    it('sets isLoading = true and clears error on pending', () => {
      const action = { type: fetchAlerts.pending.type };
      const next = alertsReducer({ ...initialState, error: 'old error' }, action);
      expect(next.isLoading).toBe(true);
      expect(next.error).toBeNull();
    });

    it('stores items and meta on fulfilled', () => {
      const items = [makeAlert('a1'), makeAlert('a2')];
      const meta = { total: 2, page: 1, limit: 20, pages: 1 };
      const action = {
        type: fetchAlerts.fulfilled.type,
        payload: { data: items, meta },
      };
      const next = alertsReducer({ ...initialState, isLoading: true }, action);

      expect(next.isLoading).toBe(false);
      expect(next.items).toHaveLength(2);
      expect(next.meta.total).toBe(2);
      expect(next.meta.pages).toBe(1);
    });

    it('falls back to empty array when payload.data is absent', () => {
      const action = { type: fetchAlerts.fulfilled.type, payload: {} };
      const next = alertsReducer(initialState, action);
      expect(next.items).toEqual([]);
    });

    it('stores error and clears loading on rejected', () => {
      const action = {
        type: fetchAlerts.rejected.type,
        payload: 'Failed to load alerts',
      };
      const next = alertsReducer({ ...initialState, isLoading: true }, action);
      expect(next.isLoading).toBe(false);
      expect(next.error).toBe('Failed to load alerts');
    });
  });

  // ── acknowledgeAlert async thunk ─────────────────────────────────────────

  describe('acknowledgeAlert thunk', () => {
    it('replaces the matching alert in items on fulfilled', () => {
      const original = makeAlert('a1');
      const acknowledged = { ...original, status: 'acknowledged' };
      const state = { ...initialState, items: [original, makeAlert('a2')] };

      const action = { type: acknowledgeAlert.fulfilled.type, payload: acknowledged };
      const next = alertsReducer(state, action);

      expect(next.items[0].status).toBe('acknowledged');
      expect(next.items[1].status).toBe('active'); // untouched
    });

    it('does not alter other items when ids do not match', () => {
      const alert = makeAlert('a1');
      const state = { ...initialState, items: [alert] };
      const action = {
        type: acknowledgeAlert.fulfilled.type,
        payload: makeAlert('nonexistent'),
      };
      const next = alertsReducer(state, action);
      expect(next.items).toHaveLength(1);
      expect(next.items[0].id).toBe('a1');
    });
  });

  // ── resolveAlert async thunk ─────────────────────────────────────────────

  describe('resolveAlert thunk', () => {
    it('replaces the matching alert with the resolved version on fulfilled', () => {
      const original = makeAlert('a1');
      const resolved = { ...original, status: 'resolved' };
      const state = { ...initialState, items: [original] };

      const action = { type: resolveAlert.fulfilled.type, payload: resolved };
      const next = alertsReducer(state, action);

      expect(next.items[0].status).toBe('resolved');
    });

    it('does not alter items when id does not match', () => {
      const alert = makeAlert('a1');
      const state = { ...initialState, items: [alert] };
      const action = {
        type: resolveAlert.fulfilled.type,
        payload: makeAlert('other'),
      };
      const next = alertsReducer(state, action);
      expect(next.items[0].status).toBe('active');
    });
  });
});

// ─── Selector tests ───────────────────────────────────────────────────────────

describe('alertsSlice selectors', () => {
  const rootState = {
    alerts: {
      items: [makeAlert('a1'), makeAlert('a2')],
      meta: { total: 2, page: 1, limit: 20, pages: 1 },
      isLoading: true,
      error: 'network error',
    },
  };

  it('selectAlerts returns the items array', () => {
    expect(selectAlerts(rootState)).toHaveLength(2);
    expect(selectAlerts(rootState)[0].id).toBe('a1');
  });

  it('selectAlertsLoading returns the isLoading flag', () => {
    expect(selectAlertsLoading(rootState)).toBe(true);
  });

  it('selectAlertsError returns the error string', () => {
    expect(selectAlertsError(rootState)).toBe('network error');
  });
});
