import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarMini: false,
    theme: 'light',
    notifications: [],
  },
  reducers: {
    toggleSidebarMini: (state) => {
      state.sidebarMini = !state.sidebarMini;
    },
    setSidebarMini: (state, action) => {
      state.sidebarMini = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    pushNotification: (state, action) => {
      state.notifications.unshift({
        id: Date.now(),
        readAt: null,
        ...action.payload,
      });
    },
    dismissNotification: (state, action) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    markNotificationRead: (state, action) => {
      const n = state.notifications.find((n) => n.id === action.payload);
      if (n) n.readAt = Date.now();
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
    },
  },
});

export const {
  toggleSidebarMini,
  setSidebarMini,
  setTheme,
  pushNotification,
  dismissNotification,
  markNotificationRead,
  clearAllNotifications,
} = uiSlice.actions;

export const selectSidebarMini = (state) => state.ui.sidebarMini;
export const selectTheme = (state) => state.ui.theme;
export const selectNotifications = (state) => state.ui.notifications;
export const selectUnreadCount = (state) =>
  state.ui.notifications.filter((n) => !n.readAt).length;

export default uiSlice.reducer;
