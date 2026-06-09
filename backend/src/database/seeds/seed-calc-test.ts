/**
 * seed-calc-test.ts
 *
 * Creates a minimal test station + two sensors with known timestamps and values
 * so the custom-calc block result can be verified manually.
 *
 * Sensor A (Temperature):
 *   10:00:00  → 10.0
 *   10:04:00  → 20.0
 *
 * Sensor B (Pressure):
 *   10:02:00  → 6.0
 *   10:06:00  → 12.0
 *
 * Formula   : a + b
 * Strategy  : interpolate
 * Aggregation: mean
 *
 * Expected custom-calc result: 22.5
 *
 *   Point 1 (t=10:00): a=10, b=clamp(6.0)     → 10 + 6  = 16.0
 *   Point 2 (t=10:04): a=20, b=interpolate=9.0 → 20 + 9  = 29.0
 *   mean = (16 + 29) / 2 = 22.5
 *
 * Usage:
 *   docker compose exec -e NODE_ENV=development backend \
 *     node dist/database/seeds/seed-calc-test.js
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Sensor, SensorStatus, SensorType } from '../entities/Sensor.entity';
import { SensorData } from '../entities/SensorData.entity';
import { Station, StationStatus, StationType } from '../entities/Station.entity';

const dataSource = new DataSource({
  type:       'postgres',
  host:       process.env.DATABASE_HOST     || 'localhost',
  port:       Number(process.env.DATABASE_PORT || 5432),
  username:   process.env.DATABASE_USER     || 'postgres',
  password:   process.env.DATABASE_PASSWORD || 'postgres',
  database:   process.env.DATABASE_NAME     || 'aquaflow',
  entities:   [Station, Sensor, SensorData],
  synchronize: process.env.NODE_ENV !== 'production',
});

// ── Fixed timestamps ──────────────────────────────────────────────────────────
// Using a fixed base date so results are always reproducible.
const BASE = new Date('2026-06-09T10:00:00.000Z');
const T    = (plusMinutes: number) => new Date(BASE.getTime() + plusMinutes * 60 * 1000);

async function run() {
  await dataSource.initialize();

  const stationRepo    = dataSource.getRepository(Station);
  const sensorRepo     = dataSource.getRepository(Sensor);
  const sensorDataRepo = dataSource.getRepository(SensorData);

  // ── Station ─────────────────────────────────────────────────────────────────
  let station = await stationRepo.findOne({ where: { name: 'Station Calcul Test' } });
  if (!station) {
    station = stationRepo.create({
      name:         'Station Calcul Test',
      location:     'Test — local verification',
      latitude:     36.8,
      longitude:    10.2,
      capacity:     1000,
      capacityUnit: 'm3/day',
      type:         StationType.MONITORING,
      status:       StationStatus.NORMAL,
      description:  'Minimal station created for custom-calc verification.',
    });
    station = await stationRepo.save(station);
  }
  console.log(`\nStation : ${station.name}`);
  console.log(`Station ID : ${station.id}`);

  // ── Sensor A — Temperature ───────────────────────────────────────────────────
  let sensorA = await sensorRepo.findOne({ where: { name: 'Capteur Temperature Test' } });
  if (!sensorA) {
    sensorA = sensorRepo.create({
      name:         'Capteur Temperature Test',
      type:         SensorType.TEMPERATURE,
      unit:         '°C',
      location:     'Zone A',
      minThreshold: 0,
      maxThreshold: 100,
      status:       SensorStatus.ACTIVE,
      alertEnabled: true,
      lastReading:  20,
      lastReadingAt: T(4),
      station,
      deviceId:     'AQF-CALC-TEST-A',
      serialNumber: 'SN-TEST-001',
    });
    sensorA = await sensorRepo.save(sensorA);
  }

  // Clear old test data for sensor A
  await sensorDataRepo.delete({ sensor: { id: sensorA.id } });

  // Insert 2 readings with fixed timestamps
  const readingsA = [
    sensorDataRepo.create({ sensor: sensorA, value: 10.0, timestamp: T(0), source: 'calc-test' }),
    sensorDataRepo.create({ sensor: sensorA, value: 20.0, timestamp: T(4), source: 'calc-test' }),
  ];
  await sensorDataRepo.save(readingsA);

  console.log(`\nSensor A : ${sensorA.name}`);
  console.log(`Sensor A ID : ${sensorA.id}`);
  console.log(`  10:00 UTC → 10.0 °C`);
  console.log(`  10:04 UTC → 20.0 °C`);

  // ── Sensor B — Pressure ──────────────────────────────────────────────────────
  let sensorB = await sensorRepo.findOne({ where: { name: 'Capteur Pression Test' } });
  if (!sensorB) {
    sensorB = sensorRepo.create({
      name:         'Capteur Pression Test',
      type:         SensorType.PRESSURE,
      unit:         'bar',
      location:     'Zone B',
      minThreshold: 0,
      maxThreshold: 20,
      status:       SensorStatus.ACTIVE,
      alertEnabled: true,
      lastReading:  12,
      lastReadingAt: T(6),
      station,
      deviceId:     'AQF-CALC-TEST-B',
      serialNumber: 'SN-TEST-002',
    });
    sensorB = await sensorRepo.save(sensorB);
  }

  // Clear old test data for sensor B
  await sensorDataRepo.delete({ sensor: { id: sensorB.id } });

  // Insert 2 readings with DIFFERENT timestamps from A
  const readingsB = [
    sensorDataRepo.create({ sensor: sensorB, value: 6.0,  timestamp: T(2), source: 'calc-test' }),
    sensorDataRepo.create({ sensor: sensorB, value: 12.0, timestamp: T(6), source: 'calc-test' }),
  ];
  await sensorDataRepo.save(readingsB);

  console.log(`\nSensor B : ${sensorB.name}`);
  console.log(`Sensor B ID : ${sensorB.id}`);
  console.log(`  10:02 UTC → 6.0 bar`);
  console.log(`  10:06 UTC → 12.0 bar`);

  // ── Expected result ──────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────');
  console.log('Formula       : a + b');
  console.log('Strategy      : interpolate');
  console.log('Aggregation   : mean');
  console.log('');
  console.log('Manual calculation:');
  console.log('  t=10:00 → a=10.0  b=clamp(6.0)=6.0   → 10+6  = 16.0');
  console.log('  t=10:04 → a=20.0  b=interp(9.0)=9.0   → 20+9  = 29.0');
  console.log('  mean = (16 + 29) / 2 = 22.5');
  console.log('');
  console.log('✅ Expected custom-calc result : 22.5');
  console.log('─────────────────────────────────────────────');
  console.log('\nConfigure custom-calc in the builder:');
  console.log(`  sensorA : ${sensorA.id}`);
  console.log(`  sensorB : ${sensorB.id}`);
  console.log('  formula : a + b');
  console.log('  timeMode: all_data');
  console.log('  resampleStrategy: interpolate');
  console.log('  aggregation: mean');
}

run()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });
