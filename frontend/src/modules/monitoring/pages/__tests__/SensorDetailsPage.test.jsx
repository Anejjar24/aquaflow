/**
 * SensorDetailsPage component tests.
 *
 * We test the three rendering states:
 *   1. Loading — spinner shown while API calls are in-flight
 *   2. Error   — error message shown when API rejects
 *   3. Loaded  — sensor name, KPI cards, Live Feed, Historical, and metadata
 *
 * Heavy dependencies (chart.js, socket.io) are mocked to keep tests fast
 * and avoid jsdom canvas limitations.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import SensorDetailsPage from '../SensorDetailsPage';
import sensorService from 'services/sensorService';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Avoid canvas errors — jsdom does not support WebGL/canvas
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
}));

// Suppress real socket.io connection
jest.mock('hooks/useSocket', () => () => ({
  socket: null,
  emit: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
}));

// Control API responses in each test
jest.mock('services/sensorService', () => ({
  __esModule: true,
  default: {
    getSensorById: jest.fn(),
    getSensorData: jest.fn(),
    exportSensorDataCsv: jest.fn(),
  },
}));

// Fix useParams + useNavigate without breaking the rest of react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ sensorId: 'sensor-uuid' }),
  useNavigate: () => jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSensor = (overrides = {}) => ({
  id: 'sensor-uuid',
  name: 'Pressure Sensor',
  type: 'pressure',
  unit: 'bar',
  status: 'active',
  alertEnabled: true,
  deviceId: 'DEV-001',
  serialNumber: 'SN-12345',
  location: 'Pump Room A',
  minThreshold: 10,
  maxThreshold: 100,
  station: { id: 'station-uuid', name: 'Station Alpha' },
  ...overrides,
});

const makeReading = (value = 42, timestamp = '2024-06-01T12:00:00.000Z') => ({
  id: `rd-${Math.random()}`,
  value,
  timestamp,
});

/** Build an isolated store with only what SensorDetailsPage needs. */
function buildStore({ realtimeConnected = false, lastSensorUpdate = null } = {}) {
  return configureStore({
    reducer: {
      auth: () => ({ user: { id: 'u1' }, accessToken: 'test-token' }),
      realtime: () => ({
        connected: realtimeConnected,
        lastSensorUpdate,
        lastConnectedAt: null,
        lastDisconnectedAt: null,
        lastAlert: null,
        events: [],
      }),
    },
  });
}

function renderPage(storeOverrides = {}) {
  const store = buildStore(storeOverrides);
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <SensorDetailsPage />
      </MemoryRouter>
    </Provider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SensorDetailsPage', () => {
  // ── Loading state ────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows a spinner while API calls are in-flight', () => {
      // Promises that never settle — page stays in loading state
      sensorService.getSensorById.mockReturnValue(new Promise(() => {}));
      sensorService.getSensorData.mockReturnValue(new Promise(() => {}));

      renderPage();

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // ── Error state ──────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows the error message when getSensorById rejects', async () => {
      sensorService.getSensorById.mockRejectedValue({
        response: { data: { message: 'Sensor not found' } },
      });
      sensorService.getSensorData.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Sensor not found')).toBeInTheDocument();
      });
    });

    it('shows a fallback message when the error has no response body', async () => {
      sensorService.getSensorById.mockRejectedValue(new Error('Network error'));
      sensorService.getSensorData.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Failed to load sensor data')).toBeInTheDocument();
      });
    });

    it('renders a Back button in the error state', async () => {
      sensorService.getSensorById.mockRejectedValue({ response: { data: {} } });
      sensorService.getSensorData.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      });
    });
  });

  // ── Loaded state — header ────────────────────────────────────────────────

  describe('loaded state — header', () => {
    beforeEach(() => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);
    });

    it('renders the sensor name as the page heading', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pressure Sensor')).toBeInTheDocument();
      });
    });

    it('renders the station name', async () => {
      renderPage();
      await waitFor(() => {
        // Station name appears in both the header and the Sensor Details section
        const matches = screen.getAllByText(/Station Alpha/i);
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('renders Back to Monitoring button', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Back to Monitoring/i)).toBeInTheDocument();
      });
    });
  });

  // ── Loaded state — KPI cards ─────────────────────────────────────────────

  describe('loaded state — KPI cards', () => {
    beforeEach(() => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);
    });

    it('renders the "Current Reading" card', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Current Reading')).toBeInTheDocument();
      });
    });

    it('renders the "Average" card', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Average')).toBeInTheDocument();
      });
    });

    it('renders the "Min Threshold" card with value', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Min Threshold')).toBeInTheDocument();
        // Exact string match avoids collision with "100 bar" (max threshold)
        expect(screen.getByText('10 bar')).toBeInTheDocument();
      });
    });

    it('renders the "Max Threshold" card with value', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Max Threshold')).toBeInTheDocument();
        expect(screen.getByText(/100.*bar/)).toBeInTheDocument();
      });
    });

    it('shows "None" for Min Threshold when sensor has no minThreshold', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor({ minThreshold: null }));

      renderPage();
      await waitFor(() => {
        // "None" appears in the Min Threshold card
        expect(screen.getAllByText('None').length).toBeGreaterThan(0);
      });
    });
  });

  // ── Loaded state — Live Feed ─────────────────────────────────────────────

  describe('loaded state — Live Feed', () => {
    it('shows "● Live" badge when WebSocket is connected', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);

      renderPage({ realtimeConnected: true });

      await waitFor(() => {
        expect(screen.getByText(/● Live/)).toBeInTheDocument();
      });
    });

    it('shows "○ Disconnected" badge when WebSocket is not connected', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);

      renderPage({ realtimeConnected: false });

      await waitFor(() => {
        expect(screen.getByText(/○ Disconnected/)).toBeInTheDocument();
      });
    });

    it('renders the "Live Feed" section heading', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Live Feed/)).toBeInTheDocument();
      });
    });
  });

  // ── Loaded state — Historical Readings ──────────────────────────────────

  describe('loaded state — Historical Readings', () => {
    it('renders the "Historical Readings" section', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Historical Readings')).toBeInTheDocument();
      });
    });

    it('renders the chart when readings are present', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55), makeReading(60)]);

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('line-chart').length).toBeGreaterThan(0);
      });
    });

    it('shows "No historical readings available" when readings array is empty', async () => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText(/No historical readings available/i),
        ).toBeInTheDocument();
      });
    });
  });

  // ── Loaded state — Sensor Details ────────────────────────────────────────

  describe('loaded state — Sensor Details', () => {
    beforeEach(() => {
      sensorService.getSensorById.mockResolvedValue(makeSensor());
      sensorService.getSensorData.mockResolvedValue([makeReading(55)]);
    });

    it('renders the "Sensor Details" section heading', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Sensor Details')).toBeInTheDocument();
      });
    });

    it('shows the device ID', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('DEV-001')).toBeInTheDocument();
      });
    });

    it('shows the serial number', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('SN-12345')).toBeInTheDocument();
      });
    });

    it('shows the sensor location', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Pump Room A')).toBeInTheDocument();
      });
    });

    it('shows "Yes" for alertEnabled when alerts are on', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });
    });

    it('shows "—" placeholders for missing optional fields', async () => {
      sensorService.getSensorById.mockResolvedValue(
        makeSensor({ deviceId: null, serialNumber: null, location: null }),
      );
      renderPage();
      await waitFor(() => {
        // Multiple "—" placeholders for deviceId, serialNumber, location, lastReading
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
