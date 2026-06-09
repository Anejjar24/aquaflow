/**
 * AdminNavbar component tests.
 *
 * We test the notification bell behaviour:
 *   - Badge is hidden when unreadCount === 0
 *   - Badge shows the correct count when unreadCount > 0
 *   - "Mark all read" link appears only when there are unread notifications
 *   - "No notifications" message renders when the list is empty
 *
 * All Redux dependencies are fulfilled by a pre-loaded store.
 * All network calls are suppressed via jest.mock on the slice thunks.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import AdminNavbar from '../AdminNavbar';

// ─── Mock heavy deps that are not under test ──────────────────────────────────

// Suppress actual fetch calls dispatched in useEffect
jest.mock('store/slices/notificationsSlice', () => {
  const actual = jest.requireActual('store/slices/notificationsSlice');
  return {
    ...actual,
    fetchUnreadCount: () => ({ type: 'notifications/fetchUnreadCount/noop' }),
    fetchNotifications: () => ({ type: 'notifications/fetchNotifications/noop' }),
    markNotificationRead: () => ({ type: 'notifications/markRead/noop' }),
    markAllNotificationsRead: () => ({ type: 'notifications/markAllRead/noop' }),
  };
});

// useLogout is a side-effectful hook — stub it
jest.mock('hooks/useLogout', () => () => jest.fn());

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeNotification = (id, readAt = null) => ({
  id,
  title: `Alert ${id}`,
  message: 'Something happened',
  severity: 'high',
  readAt,
  createdAt: new Date().toISOString(),
});

/** Build an isolated store pre-loaded with the given notification state. */
function buildStore({ unreadCount = 0, items = [] } = {}) {
  // Minimal slice reducers — only what the component needs
  return configureStore({
    reducer: {
      auth: () => ({
        user: { id: 'u1', email: 'admin@aquaflow.io', firstname: 'Admin', lastname: 'User' },
        accessToken: 'fake_token',
      }),
      notifications: () => ({
        items,
        unreadCount,
        meta: { total: items.length, page: 1, limit: 20, pages: 1 },
        isLoading: false,
        error: null,
      }),
    },
  });
}

function renderNavbar(storeOverrides = {}) {
  const store = buildStore(storeOverrides);
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminNavbar brandText="AquaFlow" />
      </MemoryRouter>
    </Provider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AdminNavbar', () => {
  // ── Bell icon ─────────────────────────────────────────────────────────────

  it('renders without crashing', () => {
    renderNavbar();
  });

  it('shows user display name in navbar', () => {
    renderNavbar();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  // ── Unread badge ──────────────────────────────────────────────────────────

  it('does NOT show an unread badge when unreadCount is 0', () => {
    renderNavbar({ unreadCount: 0 });
    // Badge element should not be present when count is 0
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows badge with correct count when unreadCount > 0', () => {
    renderNavbar({ unreadCount: 3 });
    // Badge renders in both the bell icon and the dropdown header
    const badges = screen.getAllByText('3');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('caps badge display at "99+" when unreadCount > 99', () => {
    renderNavbar({ unreadCount: 150 });
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  // ── Empty notification list ───────────────────────────────────────────────

  it('shows "No notifications" when list is empty', () => {
    renderNavbar({ items: [], unreadCount: 0 });
    expect(screen.getByText(/No notifications/i)).toBeInTheDocument();
  });

  // ── Notification items ────────────────────────────────────────────────────

  it('renders notification titles when items are present', () => {
    const items = [
      makeNotification('n1'),
      makeNotification('n2'),
    ];
    renderNavbar({ items, unreadCount: 2 });
    expect(screen.getByText('Alert n1')).toBeInTheDocument();
    expect(screen.getByText('Alert n2')).toBeInTheDocument();
  });

  it('shows "Mark all read" link when there are unread notifications', () => {
    const items = [makeNotification('n1', null)];
    renderNavbar({ items, unreadCount: 1 });
    expect(screen.getByText(/Mark all read/i)).toBeInTheDocument();
  });

  it('does NOT show "Mark all read" when unreadCount is 0', () => {
    const items = [makeNotification('n1', new Date().toISOString())]; // all read
    renderNavbar({ items, unreadCount: 0 });
    expect(screen.queryByText(/Mark all read/i)).not.toBeInTheDocument();
  });

  it('shows individual "Mark read" buttons only for unread items', () => {
    const items = [
      makeNotification('n1', null),                        // unread
      makeNotification('n2', new Date().toISOString()),    // already read
    ];
    renderNavbar({ items, unreadCount: 1 });

    // Only one "Mark read" button for the unread item
    const markReadButtons = screen.getAllByText('Mark read');
    expect(markReadButtons).toHaveLength(1);
  });

  // ── View all link ─────────────────────────────────────────────────────────

  it('renders "View all notifications" link', () => {
    renderNavbar();
    expect(screen.getByText(/View all notifications/i)).toBeInTheDocument();
  });
});
