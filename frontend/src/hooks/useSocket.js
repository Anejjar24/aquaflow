import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import {
  alertReceived,
  sensorUpdateReceived,
  socketConnected,
  socketDisconnected,
  stationStatusReceived,
} from '../store/slices/realtimeSlice';
import {
  addDashboardAlert,
  applySensorUpdate,
  updateStationStatus,
} from '../store/slices/dashboardSlice';
import { selectAccessToken, selectUser } from '../store/slices/authSlice';
import { sensorRealtimeUpdated } from '../store/slices/sensorsSlice';
import { alertRealtimeReceived } from '../store/slices/alertsSlice';
import { stationRealtimeUpdated } from '../store/slices/stationsSlice';
import {
  notificationReceived,
  allNotificationsCleared,
} from '../store/slices/notificationsSlice';

const SOCKET_URL = process.env.REACT_APP_WS_URL || 'http://localhost:3001';

export default function useSocket(enabled = true) {
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const token = useSelector(selectAccessToken);
  const user = useSelector(selectUser);

  useEffect(() => {
    if (!enabled || !token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      query: { userId: user?.id || 'anonymous' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      dispatch(socketConnected());
      socket.emit('subscribe', { channel: 'dashboard' });
      socket.emit('subscribe', { channel: 'alerts' });
      socket.emit('subscribe', { channel: 'stations' });
      socket.emit('subscribe', { channel: 'sensors' });
    });

    socket.on('disconnect', () => {
      dispatch(socketDisconnected());
    });

    socket.on('sensor-update', (data) => {
      dispatch(sensorUpdateReceived(data));
      dispatch(sensorRealtimeUpdated(data));
      dispatch(applySensorUpdate(data));
    });

    socket.on('alert-created', (data) => {
      dispatch(alertReceived(data));
      dispatch(alertRealtimeReceived(data));
      dispatch(addDashboardAlert(data));
    });

    socket.on('station-status', (data) => {
      dispatch(stationStatusReceived(data));
      dispatch(updateStationStatus(data));
      dispatch(stationRealtimeUpdated(data));
    });

    socket.on('notification-created', (data) => {
      dispatch(notificationReceived(data));
    });

    socket.on('notifications-read-all', () => {
      dispatch(allNotificationsCleared());
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, enabled, token, user?.id]);

  return useMemo(
    () => ({
      socket: socketRef.current,
      emit: (event, payload) => socketRef.current?.emit(event, payload),
      subscribe: (channel) => socketRef.current?.emit('subscribe', { channel }),
      unsubscribe: (channel) => socketRef.current?.emit('unsubscribe', { channel }),
    }),
    []
  );
}
