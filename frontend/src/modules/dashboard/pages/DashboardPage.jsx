import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Col, Container, Row } from 'reactstrap';
import useSocket from '../../../hooks/useSocket';
import { fetchAlerts, selectAlerts } from '../../../store/slices/alertsSlice';
import { selectRealtime } from '../../../store/slices/realtimeSlice';
import { fetchSensors, selectSensors } from '../../../store/slices/sensorsSlice';
import { fetchStations, selectStations } from '../../../store/slices/stationsSlice';
import KPISection from '../components/KPISection';
import AlertsFeed from '../components/AlertsFeed';
import StationOverview from '../components/StationOverview';
import RealtimeStats from '../components/RealtimeStats';
import TrendCharts from '../components/TrendCharts';

export default function DashboardPage() {
  const dispatch = useDispatch();
  useSocket(true);

  const alerts = useSelector(selectAlerts);
  const sensors = useSelector(selectSensors);
  const stations = useSelector(selectStations);
  const realtime = useSelector(selectRealtime);

  useEffect(() => {
    dispatch(fetchStations());
    dispatch(fetchSensors());
    dispatch(fetchAlerts({ limit: 8 }));
  }, [dispatch]);

  const activeAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === 'active'),
    [alerts],
  );

  const kpis = useMemo(() => {
    const activeStations = stations.filter((station) => station.status !== 'offline').length;
    const pressureSensors = sensors.filter((sensor) => sensor.type === 'pressure' && sensor.lastReading !== null);
    const flowSensors = sensors.filter((sensor) => sensor.type === 'flow' && sensor.lastReading !== null);
    const avgPressure = pressureSensors.length
      ? pressureSensors.reduce((total, sensor) => total + Number(sensor.lastReading || 0), 0) / pressureSensors.length
      : 0;
    const totalFlow = flowSensors.reduce((total, sensor) => total + Number(sensor.lastReading || 0), 0);

    return [
      {
        id: 'stations',
        label: 'Active Stations',
        value: activeStations,
        unit: '',
        trend: `${stations.length} total`,
        status: activeStations === stations.length ? 'normal' : 'warning',
        icon: 'ni ni-building',
      },
      {
        id: 'pressure',
        label: 'Avg Pressure',
        value: avgPressure ? avgPressure.toFixed(1) : '0.0',
        unit: 'bar',
        trend: `${pressureSensors.length} sensors`,
        status: avgPressure > 7 ? 'critical' : avgPressure > 5.5 ? 'warning' : 'normal',
        icon: 'ni ni-sound-wave',
      },
      {
        id: 'flow',
        label: 'Total Flow',
        value: Math.round(totalFlow).toLocaleString(),
        unit: 'm3/h',
        trend: `${flowSensors.length} meters`,
        status: 'normal',
        icon: 'ni ni-delivery-fast',
      },
      {
        id: 'alerts',
        label: 'Active Alerts',
        value: activeAlerts.length,
        unit: '',
        trend: `${alerts.length} total`,
        status: activeAlerts.some((alert) => alert.severity === 'critical') ? 'critical' : 'warning',
        icon: 'ni ni-bell-55',
      },
    ];
  }, [activeAlerts, alerts, sensors, stations]);

  const stationOverview = useMemo(
    () =>
      stations.map((station) => {
        const stationSensors = sensors.filter((sensor) => sensor.station?.id === station.id);
        const onlineSensors = stationSensors.filter((sensor) => sensor.status === 'active');
        const pressureSensor = stationSensors.find((sensor) => sensor.type === 'pressure');
        const flowSensor = stationSensors.find((sensor) => sensor.type === 'flow');

        return {
          id: station.id,
          name: station.name,
          region: station.location,
          status: station.status,
          pressure: pressureSensor?.lastReading ?? null,
          flow: flowSensor?.lastReading ?? null,
          sensorsOnline: onlineSensors.length,
          sensorsTotal: stationSensors.length,
        };
      }),
    [sensors, stations],
  );

  const alertFeed = useMemo(
    () =>
      activeAlerts.slice(0, 8).map((alert) => ({
        id: alert.id,
        station: alert.station?.name || 'AquaFlow automation',
        severity: alert.severity,
        message: alert.message,
        time: alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Just now',
      })),
    [activeAlerts],
  );

  return (
    <>
      <div className="header bg-gradient-info pb-8 pt-5 pt-md-8">
        <Container fluid>
          <div className="header-body">
            <KPISection kpis={kpis} />
          </div>
        </Container>
      </div>
      <Container className="mt--7" fluid>
        <Row>
          <Col xl="8" className="mb-5 mb-xl-0">
            <StationOverview stations={stationOverview} />
          </Col>
          <Col xl="4">
            <AlertsFeed alerts={alertFeed} />
          </Col>
        </Row>
        <Row className="mt-5">
          <Col xl="4" className="mb-5 mb-xl-0">
            <RealtimeStats realtime={realtime} />
          </Col>
          <Col xl="8">
            <TrendCharts stations={stations} />
          </Col>
        </Row>
      </Container>
    </>
  );
}
