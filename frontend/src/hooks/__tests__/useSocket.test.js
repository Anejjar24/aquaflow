/**
 * useSocket hook tests.
 *
 * We verify:
 *   - No socket is created when `enabled = false` or when no auth token is present
 *   - socket.io is initialised with the correct URL and auth options when active
 *   - Each WebSocket event dispatches the expected Redux actions
 *   - The socket is disconnected on cleanup (unmount)
 *
 * socket.io-client is mocked — no real network connections are made.
 * useDispatch / useSelector are mocked directly so no Provider/Store needed.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import useSocket from '../useSocket';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

// Mock useDispatch and useSelector at the react-redux level so we don't need
// a Redux store, a Provider, or to mock every imported action creator.
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Import the mocked versions so we can configure them in each test
import { useDispatch, useSelector } from 'react-redux';

function makeFakeSocket() {
  return {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
}

/**
 * Find the handler registered for a given socket event name.
 * Returns the callback or undefined.
 */
function getSocketHandler(fakeSocket, eventName) {
  const call = fakeSocket.on.mock.calls.find(([name]) => name === eventName);
  return call ? call[1] : undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSocket', () => {
  let fakeSocket;
  let mockDispatch;

  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    io.mockReturnValue(fakeSocket);

    mockDispatch = jest.fn();
    useDispatch.mockReturnValue(mockDispatch);

    // Simulate a logged-in user with a valid token
    useSelector.mockImplementation((selector) =>
      selector({
        auth: {
          accessToken: 'test-token',
          user: { id: 'u1', name: 'Test User' },
        },
      }),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Guard conditions ──────────────────────────────────────────────────────

  describe('guard conditions', () => {
    it('does NOT create a socket when enabled = false', () => {
      renderHook(() => useSocket(false));
      expect(io).not.toHaveBeenCalled();
    });

    it('does NOT create a socket when auth token is null', () => {
      useSelector.mockImplementation((selector) =>
        selector({ auth: { accessToken: null, user: null } }),
      );
      renderHook(() => useSocket(true));
      expect(io).not.toHaveBeenCalled();
    });

    it('does NOT create a socket when auth token is an empty string', () => {
      useSelector.mockImplementation((selector) =>
        selector({ auth: { accessToken: '', user: null } }),
      );
      renderHook(() => useSocket(true));
      expect(io).not.toHaveBeenCalled();
    });
  });

  // ── Socket creation ───────────────────────────────────────────────────────

  describe('socket creation', () => {
    it('calls io() with auth.token when enabled and token is present', () => {
      renderHook(() => useSocket(true));

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ auth: { token: 'test-token' } }),
      );
    });

    it('includes websocket and polling transports', () => {
      renderHook(() => useSocket(true));

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ transports: ['websocket', 'polling'] }),
      );
    });

    it('enables reconnection', () => {
      renderHook(() => useSocket(true));

      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ reconnection: true }),
      );
    });
  });

  // ── Event handlers ────────────────────────────────────────────────────────

  describe('event: connect', () => {
    it('dispatches socketConnected', () => {
      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'connect')?.());

      const types = mockDispatch.mock.calls.map(([a]) => a?.type ?? a);
      expect(types).toContain('realtime/socketConnected');
    });

    it('emits subscribe for dashboard, alerts, stations, and sensors channels', () => {
      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'connect')?.());

      const subscribeCalls = fakeSocket.emit.mock.calls.filter(
        ([event]) => event === 'subscribe',
      );
      const channels = subscribeCalls.map(([, { channel }]) => channel);

      expect(channels).toContain('dashboard');
      expect(channels).toContain('alerts');
      expect(channels).toContain('stations');
      expect(channels).toContain('sensors');
    });
  });

  describe('event: disconnect', () => {
    it('dispatches socketDisconnected', () => {
      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'disconnect')?.());

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('realtime/socketDisconnected');
    });
  });

  describe('event: sensor-update', () => {
    it('dispatches sensorUpdateReceived, sensorRealtimeUpdated, and applySensorUpdate', () => {
      const payload = { sensorId: 's1', value: 42 };

      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'sensor-update')?.(payload));

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('realtime/sensorUpdateReceived');
      expect(types).toContain('sensors/sensorRealtimeUpdated');
      expect(types).toContain('dashboard/applySensorUpdate');
    });
  });

  describe('event: alert-created', () => {
    it('dispatches alertReceived, alertRealtimeReceived, and addDashboardAlert', () => {
      const payload = { id: 'a1', severity: 'critical' };

      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'alert-created')?.(payload));

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('realtime/alertReceived');
      expect(types).toContain('alerts/alertRealtimeReceived');
      expect(types).toContain('dashboard/addDashboardAlert');
    });
  });

  describe('event: station-status', () => {
    it('dispatches stationStatusReceived, updateStationStatus, and stationRealtimeUpdated', () => {
      const payload = { stationId: 'st1', status: 'warning' };

      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'station-status')?.(payload));

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('realtime/stationStatusReceived');
      expect(types).toContain('dashboard/updateStationStatus');
      expect(types).toContain('stations/stationRealtimeUpdated');
    });
  });

  describe('event: notification-created', () => {
    it('dispatches notificationReceived', () => {
      const payload = { id: 'n1', message: 'Alert resolved' };

      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'notification-created')?.(payload));

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('notifications/notificationReceived');
    });
  });

  describe('event: notifications-read-all', () => {
    it('dispatches allNotificationsCleared', () => {
      renderHook(() => useSocket(true));
      act(() => getSocketHandler(fakeSocket, 'notifications-read-all')?.());

      const types = mockDispatch.mock.calls.map(([a]) => a?.type);
      expect(types).toContain('notifications/allNotificationsCleared');
    });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  describe('cleanup on unmount', () => {
    it('calls socket.disconnect() when the hook unmounts', () => {
      const { unmount } = renderHook(() => useSocket(true));
      act(() => unmount());

      expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not call disconnect when no socket was ever created (no token)', () => {
      useSelector.mockImplementation((selector) =>
        selector({ auth: { accessToken: null, user: null } }),
      );
      const { unmount } = renderHook(() => useSocket(true));
      act(() => unmount());

      expect(fakeSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  // ── Return value ──────────────────────────────────────────────────────────

  describe('return value', () => {
    it('exposes emit, subscribe, and unsubscribe helper functions', () => {
      const { result } = renderHook(() => useSocket(true));

      expect(typeof result.current.emit).toBe('function');
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.unsubscribe).toBe('function');
    });

    it('subscribe calls socket.emit("subscribe", { channel })', () => {
      const { result } = renderHook(() => useSocket(true));
      act(() => result.current.subscribe('my-channel'));

      expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe', {
        channel: 'my-channel',
      });
    });

    it('unsubscribe calls socket.emit("unsubscribe", { channel })', () => {
      const { result } = renderHook(() => useSocket(true));
      act(() => result.current.unsubscribe('my-channel'));

      expect(fakeSocket.emit).toHaveBeenCalledWith('unsubscribe', {
        channel: 'my-channel',
      });
    });
  });
});
