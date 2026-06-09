/**
 * Unit tests for notificationsSlice reducers and selectors.
 *
 * These tests exercise the pure Redux logic in isolation — no network calls,
 * no React components, no WebSocket.  We feed actions directly into the
 * reducer and assert on the resulting state.
 */

import notificationsReducer, {
  notificationReceived,
  allNotificationsCleared,
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  selectNotifications,
  selectUnreadCount,
  selectNotificationsLoading,
  selectNotificationsMeta,
} from '../notificationsSlice';

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  items: [],
  unreadCount: 0,
  meta: { total: 0, page: 1, limit: 20, pages: 0 },
  isLoading: false,
  error: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeNotification = (id = 'n1', readAt = null) => ({
  id,
  subject: 'Test Alert',
  message: 'Something happened',
  severity: 'high',
  readAt,
  createdAt: new Date().toISOString(),
});

// ─── Reducer tests ────────────────────────────────────────────────────────────

describe('notificationsSlice reducer', () => {
  it('returns the initial state', () => {
    expect(notificationsReducer(undefined, { type: '@@INIT' })).toEqual(
      initialState,
    );
  });

  // ── notificationReceived ─────────────────────────────────────────────────

  describe('notificationReceived', () => {
    it('prepends the notification to items', () => {
      const existing = makeNotification('n1');
      const incoming = makeNotification('n2');
      const state = { ...initialState, items: [existing], unreadCount: 1 };

      const next = notificationsReducer(state, notificationReceived(incoming));

      expect(next.items[0].id).toBe('n2');
      expect(next.items[1].id).toBe('n1');
    });

    it('increments unreadCount by 1', () => {
      const state = { ...initialState, unreadCount: 3 };
      const next = notificationsReducer(
        state,
        notificationReceived(makeNotification()),
      );
      expect(next.unreadCount).toBe(4);
    });

    it('increments meta.total by 1', () => {
      const state = { ...initialState, meta: { ...initialState.meta, total: 5 } };
      const next = notificationsReducer(
        state,
        notificationReceived(makeNotification()),
      );
      expect(next.meta.total).toBe(6);
    });
  });

  // ── allNotificationsCleared ───────────────────────────────────────────────

  describe('allNotificationsCleared', () => {
    it('resets unreadCount to 0', () => {
      const state = { ...initialState, unreadCount: 7 };
      const next = notificationsReducer(state, allNotificationsCleared());
      expect(next.unreadCount).toBe(0);
    });

    it('does NOT touch the items array', () => {
      const items = [makeNotification('n1'), makeNotification('n2')];
      const state = { ...initialState, items, unreadCount: 2 };
      const next = notificationsReducer(state, allNotificationsCleared());
      expect(next.items).toHaveLength(2);
    });
  });

  // ── fetchNotifications async thunk ────────────────────────────────────────

  describe('fetchNotifications thunk', () => {
    it('sets isLoading = true on pending', () => {
      const action = { type: fetchNotifications.pending.type };
      const next = notificationsReducer(initialState, action);
      expect(next.isLoading).toBe(true);
      expect(next.error).toBeNull();
    });

    it('stores items and meta on fulfilled', () => {
      const items = [makeNotification('n1'), makeNotification('n2')];
      const meta = { total: 2, page: 1, limit: 20, pages: 1 };
      const action = {
        type: fetchNotifications.fulfilled.type,
        payload: { data: items, meta },
      };
      const next = notificationsReducer(
        { ...initialState, isLoading: true },
        action,
      );
      expect(next.isLoading).toBe(false);
      expect(next.items).toHaveLength(2);
      expect(next.meta.total).toBe(2);
    });

    it('stores error on rejected', () => {
      const action = {
        type: fetchNotifications.rejected.type,
        payload: 'Failed to load notifications',
      };
      const next = notificationsReducer(
        { ...initialState, isLoading: true },
        action,
      );
      expect(next.isLoading).toBe(false);
      expect(next.error).toBe('Failed to load notifications');
    });
  });

  // ── fetchUnreadCount ──────────────────────────────────────────────────────

  describe('fetchUnreadCount thunk', () => {
    it('sets unreadCount on fulfilled', () => {
      const action = {
        type: fetchUnreadCount.fulfilled.type,
        payload: { count: 5 },
      };
      const next = notificationsReducer(initialState, action);
      expect(next.unreadCount).toBe(5);
    });
  });

  // ── markNotificationRead ──────────────────────────────────────────────────

  describe('markNotificationRead thunk', () => {
    it('replaces the notification in items and decrements unreadCount', () => {
      const notif = makeNotification('n1', null); // unread
      const state = { ...initialState, items: [notif], unreadCount: 1 };

      const updated = { ...notif, readAt: new Date().toISOString() };
      const action = {
        type: markNotificationRead.fulfilled.type,
        payload: updated,
      };

      const next = notificationsReducer(state, action);
      expect(next.items[0].readAt).not.toBeNull();
      expect(next.unreadCount).toBe(0);
    });

    it('does not go below 0 for unreadCount', () => {
      const notif = makeNotification('n1', null);
      const state = { ...initialState, items: [notif], unreadCount: 0 };
      const action = {
        type: markNotificationRead.fulfilled.type,
        payload: { ...notif, readAt: new Date().toISOString() },
      };
      const next = notificationsReducer(state, action);
      expect(next.unreadCount).toBe(0);
    });
  });

  // ── markAllNotificationsRead ──────────────────────────────────────────────

  describe('markAllNotificationsRead thunk', () => {
    it('sets readAt on all items and resets unreadCount', () => {
      const items = [
        makeNotification('n1', null),
        makeNotification('n2', null),
      ];
      const state = { ...initialState, items, unreadCount: 2 };

      const action = { type: markAllNotificationsRead.fulfilled.type };
      const next = notificationsReducer(state, action);

      expect(next.unreadCount).toBe(0);
      next.items.forEach((item) => {
        expect(item.readAt).not.toBeNull();
      });
    });
  });
});

// ─── Selector tests ───────────────────────────────────────────────────────────

describe('notificationsSlice selectors', () => {
  const rootState = {
    notifications: {
      items: [makeNotification('n1'), makeNotification('n2')],
      unreadCount: 2,
      meta: { total: 2, page: 1, limit: 20, pages: 1 },
      isLoading: false,
      error: null,
    },
  };

  it('selectNotifications returns items array', () => {
    expect(selectNotifications(rootState)).toHaveLength(2);
  });

  it('selectUnreadCount returns the count', () => {
    expect(selectUnreadCount(rootState)).toBe(2);
  });

  it('selectNotificationsLoading returns loading flag', () => {
    expect(selectNotificationsLoading(rootState)).toBe(false);
  });

  it('selectNotificationsMeta returns meta object', () => {
    expect(selectNotificationsMeta(rootState)).toEqual(
      expect.objectContaining({ total: 2, page: 1 }),
    );
  });
});
