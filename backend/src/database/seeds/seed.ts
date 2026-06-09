import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource, In } from 'typeorm';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from '../entities/Alert.entity';
import {
  Maintenance,
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
} from '../entities/Maintenance.entity';
import { Notification } from '../entities/Notification.entity';
import { SensorData } from '../entities/SensorData.entity';
import {
  Sensor,
  SensorStatus,
  SensorType,
} from '../entities/Sensor.entity';
import {
  Station,
  StationStatus,
  StationType,
} from '../entities/Station.entity';
import { User, UserRole } from '../entities/User.entity';
import { WorkflowExecution } from '../entities/WorkflowExecution.entity';
import { Workflow } from '../entities/Workflow.entity';

const seedTag = 'aquaflow-demo';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'aquaflow',
  entities: [
    User,
    Station,
    Sensor,
    SensorData,
    Alert,
    Maintenance,
    Workflow,
    WorkflowExecution,
    Notification,
  ],
  synchronize: process.env.NODE_ENV !== 'production',
});

const users = [
  {
    email: 'admin@aquaflow.local',
    password: 'Admin123!',
    firstname: 'Amina',
    lastname: 'Ben Salem',
    role: UserRole.ADMIN,
  },
  {
    email: 'operator@aquaflow.local',
    password: 'Operator123!',
    firstname: 'Yassine',
    lastname: 'Mansouri',
    role: UserRole.OPERATOR,
  },
  {
    email: 'technician@aquaflow.local',
    password: 'Tech123!',
    firstname: 'Nour',
    lastname: 'Haddad',
    role: UserRole.TECHNICIAN,
  },
  {
    email: 'analyst@aquaflow.local',
    password: 'Analyst123!',
    firstname: 'Sami',
    lastname: 'Trabelsi',
    role: UserRole.ANALYST,
  },
];

const stationSeeds = [
  {
    name: 'Station Centrale Tunis',
    location: 'Tunis - Charguia Industrial Zone',
    latitude: 36.8432,
    longitude: 10.2381,
    capacity: 48000,
    capacityUnit: 'm3/day',
    type: StationType.TREATMENT,
    status: StationStatus.WARNING,
    description:
      'Primary treatment station supervising pressure, chlorine, pH, and distribution flow for northern Tunis.',
    equipments: ['Pump P-101', 'Chlorination skid CL-01', 'Sand filter F-12'],
  },
  {
    name: 'Reservoir Sousse Nord',
    location: 'Sousse - Akouda',
    latitude: 35.8691,
    longitude: 10.5887,
    capacity: 26000,
    capacityUnit: 'm3',
    type: StationType.STORAGE,
    status: StationStatus.NORMAL,
    description:
      'Storage reservoir with level and quality monitoring for the north Sousse distribution ring.',
    equipments: ['Level transmitter LT-204', 'Outlet valve V-22'],
  },
  {
    name: 'Pompage Sfax Sud',
    location: 'Sfax - Route Gabes',
    latitude: 34.7398,
    longitude: 10.7601,
    capacity: 31000,
    capacityUnit: 'm3/day',
    type: StationType.DISTRIBUTION,
    status: StationStatus.CRITICAL,
    description:
      'High pressure pumping station feeding industrial and residential districts south of Sfax.',
    equipments: ['Pump P-301', 'Pump P-302', 'Pressure vessel PV-03'],
  },
  {
    name: 'Controle Qualite Bizerte',
    location: 'Bizerte - Menzel Jemil',
    latitude: 37.2364,
    longitude: 9.9221,
    capacity: 12000,
    capacityUnit: 'm3/day',
    type: StationType.MONITORING,
    status: StationStatus.NORMAL,
    description:
      'Quality monitoring station focused on pH, turbidity, chlorine, and temperature sampling.',
    equipments: ['Analyzer QA-11', 'Sampler SP-04'],
  },
  {
    name: 'Station Secours Kairouan',
    location: 'Kairouan - Zone Ouest',
    latitude: 35.6781,
    longitude: 10.0963,
    capacity: 18000,
    capacityUnit: 'm3/day',
    type: StationType.TREATMENT,
    status: StationStatus.OFFLINE,
    description:
      'Backup station currently offline pending pump inspection and electrical cabinet verification.',
    equipments: ['Pump P-501', 'Generator G-02'],
  },
];

const sensorSeeds = [
  ['Station Centrale Tunis', 'Tunis Inlet Pressure', SensorType.PRESSURE, 'bar', 'Inlet manifold', 2.2, 5.8, 6.4, SensorStatus.ACTIVE, true],
  ['Station Centrale Tunis', 'Tunis Outlet Flow', SensorType.FLOW, 'm3/h', 'Distribution header', 500, 2200, 1840, SensorStatus.ACTIVE, true],
  ['Station Centrale Tunis', 'Tunis Chlorine Residual', SensorType.CHLORINE, 'mg/L', 'Post chlorination', 0.2, 0.8, 0.74, SensorStatus.ACTIVE, true],
  ['Reservoir Sousse Nord', 'Sousse Reservoir Level', SensorType.LEVEL, '%', 'Reservoir basin', 35, 95, 72, SensorStatus.ACTIVE, true],
  ['Reservoir Sousse Nord', 'Sousse Turbidity', SensorType.TURBIDITY, 'NTU', 'Outlet sampling line', 0, 4, 1.7, SensorStatus.ACTIVE, true],
  ['Reservoir Sousse Nord', 'Sousse Outlet Flow', SensorType.FLOW, 'm3/h', 'Outlet chamber', 200, 1400, 980, SensorStatus.ACTIVE, true],
  ['Pompage Sfax Sud', 'Sfax Pump Pressure', SensorType.PRESSURE, 'bar', 'Pump discharge', 3.5, 7.2, 8.1, SensorStatus.ACTIVE, true],
  ['Pompage Sfax Sud', 'Sfax Motor Temperature', SensorType.TEMPERATURE, 'C', 'Pump P-301 motor', 5, 75, 82, SensorStatus.ACTIVE, true],
  ['Pompage Sfax Sud', 'Sfax Flow Meter', SensorType.FLOW, 'm3/h', 'Main outlet', 400, 2600, 2480, SensorStatus.ACTIVE, true],
  ['Controle Qualite Bizerte', 'Bizerte pH Analyzer', SensorType.PH, 'pH', 'Analyzer cabinet', 6.8, 8.2, 7.42, SensorStatus.ACTIVE, true],
  ['Controle Qualite Bizerte', 'Bizerte Temperature', SensorType.TEMPERATURE, 'C', 'Sampling loop', 5, 35, 22.7, SensorStatus.ACTIVE, false],
  ['Controle Qualite Bizerte', 'Bizerte Chlorine', SensorType.CHLORINE, 'mg/L', 'Quality skid', 0.2, 0.8, 0.49, SensorStatus.ACTIVE, true],
  ['Station Secours Kairouan', 'Kairouan Pump Pressure', SensorType.PRESSURE, 'bar', 'Emergency pump outlet', 2.0, 5.5, 0, SensorStatus.OFFLINE, true],
  ['Station Secours Kairouan', 'Kairouan Tank Level', SensorType.LEVEL, '%', 'Emergency tank', 30, 90, 28, SensorStatus.OFFLINE, true],
  ['Station Secours Kairouan', 'Kairouan Turbidity', SensorType.TURBIDITY, 'NTU', 'Outlet sampling line', 0, 4, 0, SensorStatus.OFFLINE, true],
] as const;

async function upsertUsers(userRepository: any) {
  const hashedUsers: User[] = [];

  for (const userSeed of users) {
    let user = await userRepository.findOne({
      where: { email: userSeed.email },
    });

    if (!user) {
      user = userRepository.create({
        ...userSeed,
        password: await bcrypt.hash(userSeed.password, 10),
        isActive: true,
      });
    } else {
      user.firstname = userSeed.firstname;
      user.lastname = userSeed.lastname;
      user.role = userSeed.role;
      user.isActive = true;
    }

    hashedUsers.push(await userRepository.save(user));
  }

  return hashedUsers;
}

async function upsertStations(
  stationRepository: any,
  createdBy: User,
): Promise<Map<string, Station>> {
  const stations = new Map<string, Station>();

  for (const stationSeed of stationSeeds) {
    let station = await stationRepository.findOne({
      where: { name: stationSeed.name },
    });

    if (!station) {
      station = stationRepository.create(stationSeed);
    }

    Object.assign(station, {
      ...stationSeed,
      createdBy,
      lastStatusChange: new Date(),
      metadata: {
        seed: seedTag,
        region: stationSeed.location.split(' - ')[0],
        operatorNote: 'Demo operational data generated for AquaFlow review.',
      },
    });

    stations.set(stationSeed.name, await stationRepository.save(station));
  }

  return stations;
}

async function upsertSensors(
  sensorRepository: any,
  stations: Map<string, Station>,
): Promise<Sensor[]> {
  const sensors: Sensor[] = [];

  for (const [
    stationName,
    name,
    type,
    unit,
    location,
    minThreshold,
    maxThreshold,
    lastReading,
    status,
    alertEnabled,
  ] of sensorSeeds) {
    const station = stations.get(stationName);
    if (!station) continue;

    let sensor = await sensorRepository.findOne({
      where: { name },
      relations: ['station'],
    });

    if (!sensor) {
      sensor = sensorRepository.create({ name });
    }

    Object.assign(sensor, {
      name,
      type,
      unit,
      location,
      minThreshold,
      maxThreshold,
      lastReading,
      lastReadingAt: status === SensorStatus.OFFLINE ? null : new Date(),
      status,
      alertEnabled,
      station,
      deviceId: `AQF-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 24)}`,
      serialNumber: `SN-${Math.abs(hashCode(name)).toString().padStart(6, '0')}`,
      metadata: {
        seed: seedTag,
        calibrationDue: status === SensorStatus.OFFLINE ? 'immediate' : '2026-07-15',
      },
    });

    sensors.push(await sensorRepository.save(sensor));
  }

  return sensors;
}

async function replaceSensorHistory(
  sensorDataRepository: any,
  sensors: Sensor[],
) {
  const sensorIds = sensors.map((sensor) => sensor.id);
  if (!sensorIds.length) return;

  await sensorDataRepository.delete({ sensor: { id: In(sensorIds) } });

  const now = Date.now();
  const rows: SensorData[] = [];

  for (const sensor of sensors) {
    const base = Number(sensor.lastReading || 0);
    const spread = sensor.type === SensorType.FLOW ? base * 0.12 : Math.max(base * 0.08, 0.4);

    for (let index = 23; index >= 0; index -= 1) {
      const angle = (24 - index) / 3;
      const noise = Math.sin(angle + sensor.id.length) * spread;
      const trend = sensor.status === SensorStatus.OFFLINE ? 0 : (24 - index) * spread * 0.008;
      const value =
        sensor.status === SensorStatus.OFFLINE
          ? 0
          : Math.max(0, round(base - spread / 2 + noise + trend));

      rows.push(
        sensorDataRepository.create({
          sensor,
          value,
          timestamp: new Date(now - index * 60 * 60 * 1000),
          source: 'demo-seed',
          accuracy: 98.5,
          qualityFlags: {
            seed: seedTag,
            quality: sensor.status === SensorStatus.OFFLINE ? 'offline' : 'good',
          },
        }),
      );
    }
  }

  await sensorDataRepository.save(rows);
}

async function replaceAlerts(
  alertRepository: any,
  stations: Map<string, Station>,
  sensors: Sensor[],
) {
  const stationIds = Array.from(stations.values()).map((station) => station.id);
  if (stationIds.length) {
    await alertRepository.delete({ station: { id: In(stationIds) } });
  }

  const sensorByName = new Map(sensors.map((sensor) => [sensor.name, sensor]));
  const alertSeeds = [
    {
      sensorName: 'Sfax Pump Pressure',
      type: AlertType.THRESHOLD_VIOLATION,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
      message: 'Sfax pump pressure above operating envelope',
      description:
        'Discharge pressure is above the configured threshold. Inspect pump P-301 and downstream valve position.',
    },
    {
      sensorName: 'Sfax Motor Temperature',
      type: AlertType.THRESHOLD_VIOLATION,
      severity: AlertSeverity.CRITICAL,
      status: AlertStatus.ACTIVE,
      message: 'Pump motor temperature critical',
      description:
        'Motor temperature exceeded safe limit. Maintenance intervention should be prioritized.',
    },
    {
      sensorName: 'Tunis Inlet Pressure',
      type: AlertType.THRESHOLD_VIOLATION,
      severity: AlertSeverity.WARNING,
      status: AlertStatus.ACKNOWLEDGED,
      message: 'Tunis inlet pressure high',
      description:
        'Pressure is slightly above normal. Operator acknowledged and is monitoring trend.',
    },
    {
      sensorName: 'Kairouan Pump Pressure',
      type: AlertType.SENSOR_OFFLINE,
      severity: AlertSeverity.ERROR,
      status: AlertStatus.ACTIVE,
      message: 'Kairouan backup station offline',
      description:
        'Emergency pump telemetry is offline. Electrical cabinet inspection is required.',
    },
    {
      sensorName: 'Sousse Turbidity',
      type: AlertType.ANOMALY,
      severity: AlertSeverity.INFO,
      status: AlertStatus.RESOLVED,
      message: 'Short turbidity deviation resolved',
      description:
        'A short turbidity variation was detected and returned to normal range.',
    },
  ];

  const alerts = alertSeeds
    .map((alertSeed) => {
      const sensor = sensorByName.get(alertSeed.sensorName);
      if (!sensor) return null;

      return alertRepository.create({
        ...alertSeed,
        sensor,
        station: sensor.station,
        sourceSystem: 'demo-seed',
        data: {
          seed: seedTag,
          currentValue: sensor.lastReading,
          minThreshold: sensor.minThreshold,
          maxThreshold: sensor.maxThreshold,
        },
        acknowledgedAt:
          alertSeed.status === AlertStatus.ACKNOWLEDGED ? new Date() : null,
        resolvedAt:
          alertSeed.status === AlertStatus.RESOLVED ? new Date() : null,
      });
    })
    .filter(Boolean);

  await alertRepository.save(alerts);
}

async function replaceMaintenance(
  maintenanceRepository: any,
  stations: Map<string, Station>,
  createdBy: User,
  assignedTo: User,
) {
  const stationIds = Array.from(stations.values()).map((station) => station.id);
  if (stationIds.length) {
    await maintenanceRepository.delete({ station: { id: In(stationIds) } });
  }

  const now = Date.now();
  const rows = [
    {
      station: stations.get('Pompage Sfax Sud'),
      title: 'Inspect pump P-301 pressure line',
      type: MaintenanceType.INSPECTION,
      status: MaintenanceStatus.IN_PROGRESS,
      priority: MaintenancePriority.CRITICAL,
      description:
        'Pressure and motor temperature alerts indicate possible downstream obstruction or pump wear.',
      equipment: 'Pump P-301',
      estimatedCost: 1450,
      estimatedDuration: 4,
      scheduledDate: new Date(now - 2 * 60 * 60 * 1000),
      startedAt: new Date(now - 60 * 60 * 1000),
    },
    {
      station: stations.get('Station Centrale Tunis'),
      title: 'Calibrate inlet pressure transmitter',
      type: MaintenanceType.CALIBRATION,
      status: MaintenanceStatus.SCHEDULED,
      priority: MaintenancePriority.HIGH,
      description:
        'Pressure trend remains high after operator acknowledgement. Calibration is scheduled.',
      equipment: 'PT-101',
      estimatedCost: 520,
      estimatedDuration: 2,
      scheduledDate: new Date(now + 24 * 60 * 60 * 1000),
    },
    {
      station: stations.get('Station Secours Kairouan'),
      title: 'Restore backup station telemetry',
      type: MaintenanceType.REPAIR,
      status: MaintenanceStatus.SCHEDULED,
      priority: MaintenancePriority.HIGH,
      description:
        'Station is offline. Verify power supply, telemetry gateway, and emergency pump instrumentation.',
      equipment: 'Telemetry cabinet TC-05',
      estimatedCost: 2100,
      estimatedDuration: 6,
      scheduledDate: new Date(now + 6 * 60 * 60 * 1000),
    },
    {
      station: stations.get('Reservoir Sousse Nord'),
      title: 'Monthly reservoir level sensor inspection',
      type: MaintenanceType.PREVENTIVE,
      status: MaintenanceStatus.COMPLETED,
      priority: MaintenancePriority.MEDIUM,
      description:
        'Routine verification of level transmitter and outlet chamber instrumentation.',
      workDone: 'Cleaned sensor well and validated transmitter reading against manual gauge.',
      equipment: 'LT-204',
      estimatedCost: 300,
      actualCost: 280,
      estimatedDuration: 1.5,
      actualDuration: 1.25,
      scheduledDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
      startedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(now - 5 * 24 * 60 * 60 * 1000 + 75 * 60 * 1000),
    },
  ];

  await maintenanceRepository.save(
    rows
      .filter((row) => row.station)
      .map((row) =>
        maintenanceRepository.create({
          ...row,
          createdBy,
          assignedTo,
          metadata: {
            seed: seedTag,
            source: 'demo maintenance planning',
          },
        }),
      ),
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashCode(value: string): number {
  return value.split('').reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0);
  }, 0);
}

async function seed() {
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const stationRepository = dataSource.getRepository(Station);
  const sensorRepository = dataSource.getRepository(Sensor);
  const sensorDataRepository = dataSource.getRepository(SensorData);
  const alertRepository = dataSource.getRepository(Alert);
  const maintenanceRepository = dataSource.getRepository(Maintenance);

  const savedUsers = await upsertUsers(userRepository);
  const admin = savedUsers.find((user) => user.role === UserRole.ADMIN) || savedUsers[0];
  const technician =
    savedUsers.find((user) => user.role === UserRole.TECHNICIAN) || admin;

  const stations = await upsertStations(stationRepository, admin);
  const sensors = await upsertSensors(sensorRepository, stations);
  const sensorsWithStations = await sensorRepository.find({
    where: { id: In(sensors.map((sensor) => sensor.id)) },
    relations: ['station'],
  });

  await replaceSensorHistory(sensorDataRepository, sensorsWithStations);
  await replaceAlerts(alertRepository, stations, sensorsWithStations);
  await replaceMaintenance(maintenanceRepository, stations, admin, technician);

  console.log('AquaFlow demo data seeded successfully.');
  console.log('Demo users:');
  users.forEach((user) => {
    console.log(`- ${user.email} / ${user.password} (${user.role})`);
  });
  console.log(`Stations: ${stations.size}`);
  console.log(`Sensors: ${sensors.length}`);
  console.log(`Sensor readings: ${sensors.length * 24}`);
}

seed()
  .catch((error) => {
    console.error('AquaFlow demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });
