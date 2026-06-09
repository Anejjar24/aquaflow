import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { notificationService } from '../../services/notificationService';

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await notificationService.getNotifications(params);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load notifications');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationService.getUnreadCount();
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to get unread count');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id, { rejectWithValue }) => {
    try {
      return await notificationService.markRead(id);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark as read');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async (_, { rejectWithValue }) => {
    try {
      return await notificationService.markAllRead();
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
    unreadCount: 0,
    meta: { total: 0, page: 1, limit: 20, pages: 0 },
    isLoading: false,
    error: null,
  },
  reducers: {
    /** Called from useSocket when notification-created WS event fires */
    notificationReceived(state, action) {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
      state.meta.total += 1;
    },
    /** Called from useSocket when notifications-read-all WS event fires */
    allNotificationsCleared(state) {
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchNotifications
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data || [];
        state.meta = action.payload.meta || state.meta;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // fetchUnreadCount
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload.count ?? 0;
      })

      // markNotificationRead
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const idx = state.items.findIndex((n) => n.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      })

      // markAllNotificationsRead
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, readAt: new Date().toISOString() }));
        state.unreadCount = 0;
      });
  },
});

export const { notificationReceived, allNotificationsCleared } = notificationsSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectNotifications = (state) => state.notifications.items;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationsLoading = (state) => state.notifications.isLoading;
export const selectNotificationsMeta = (state) => state.notifications.meta;

export default notificationsSlice.reducer;
