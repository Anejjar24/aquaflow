/**
 * seed-stream-test.ts
 *
 * Creates a station with TWO sensors producing a realistic stream of readings
 * at DIFFERENT timestamps (30-second offset) so custom-calc interpolation
 * can be manually verified.
 *
 * ─── Sensor A (Temperature) — every 60 s ──────────────────────────────────
 *   T+0 min  →  0    T+4 min  →  8
 *   T+1 min  →  2    T+5 min  → 10
 *   T+2 min  →  4    T+6 min  → 12
 *   T+3 min  →  6    T+7 min  → 14
 *                    T+8 min  → 16
 *                    T+9 min  → 18
 *
 * ─── Sensor B (Pressure) — every 60 s, offset +30 s ──────────────────────
 *   T+0.5 min →  1   T+4.5 min →  9
 *   T+1.5 min →  3   T+5.5 min → 11
 *   T+2.5 min →  5   T+6.5 min → 13
 *   T+3.5 min →  7   T+7.5 min → 15
 *                    T+8.5 min → 17
 *                    T+9.5 min → 19
 *
 * ─── Manual calculation ───────────────────────────────────────────────────
 * formula: a + b   |   strategy: interpolate   |   aggregation: mean
 *
 * Sensor A is the reference grid (same count → first wins).
 * At each A timestamp, B is linearly interpolated (ratio always = 0.5):
 *
 *   t=T+0  a= 0  b=clamp(1)=1   →  0+ 1= 1
 *   t=T+1  a= 2  b=interp=2     →  2+ 2= 4
 *   t=T+2  a= 4  b=interp=4     →  4+ 4= 8
 *   t=T+3  a= 6  b=interp=6     →  6+ 6=12
 *   t=T+4  a= 8  b=interp=8     →  8+ 8=16
 *   t=T+5  a=10  b=interp=10    → 10+10=20
 *   t=T+6  a=12  b=interp=12    → 12+12=24
 *   t=T+7  a=14  b=interp=14    → 14+14=28
 *   t=T+8  a=16  b=interp=16    → 16+16=32
 *   t=T+9  a=18  b=interp=18    → 18+18=36
 *
 *   sum  = 1+4+8+12+16+20+24+28+32+36 = 181
 *   mean = 181 / 10 = 18.1
 *
 * ✅ Expected custom-calc result: 18.1
 *
 * Usage:
 *   docker compose exec backend npm run build
 *   docker compose exec -e NODE_ENV=development backend \
 *     node dist/database/seeds/seed-stream-test.js
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Sensor, SensorStatus, SensorType } from '../entities/Sensor.entity';
import { SensorData } from '../entities/SensorData.entity';
import { Station, StationStatus, StationType } from '../entities/Station.entity';

const dataSource = new DataSource({
  type:        'postgres',
  host:        process.env.DATABASE_HOST     || 'localhost',
  port:        Number(process.env.DATABASE_PORT || 5432),
  username:    process.env.DATABASE_USER     || 'postgres',
  password:    process.env.DATABASE_PASSWORD || 'postgres',
  database:    process.env.DATABASE_NAME     || 'aquaflow',
  entities:    [Station, Sensor, SensorData],
  synchronize: process.env.NODE_ENV !== 'production',
});

// Base date — fixed so results are always reproducible
const BASE = new Date('2026-06-09T10:00:00.000Z');
const sec  = (s: number) => new Date(BASE.getTime() + s * 1000);
const min  = (m: number) => sec(m * 60);

// ── Stream data ───────────────────────────────────────────────────────────────

/** Sensor A — 10 readings every 60 s starting at T+0 */
const STREAM_A: { timestamp: Date; value: number }[] = [
  { timestamp: min(0), value:  0 },
  { timestamp: min(1), value:  2 },
  { timestamp: min(2), value:  4 },
  { timestamp: min(3), value:  6 },
  { timestamp: min(4), value:  8 },
  { timestamp: min(5), value: 10 },
  { timestamp: min(6), value: 12 },
  { timestamp: min(7), value: 14 },
  { timestamp: min(8), value: 16 },
  { timestamp: min(9), value: 18 },
];

/** Sensor B — 10 readings every 60 s, offset +30 s */
const STREAM_B: { timestamp: Date; value: number }[] = [
  { timestamp: sec(30),  value:  1 },
  { timestamp: sec(90),  value:  3 },
  { timestamp: sec(150), value:  5 },
  { timestamp: sec(210), value:  7 },
  { timestamp: sec(270), value:  9 },
  { timestamp: sec(330), value: 11 },
  { timestamp: sec(390), value: 13 },
  { timestamp: sec(450), value: 15 },
  { timestamp: sec(510), value: 17 },
  { timestamp: sec(570), value: 19 },
];

async function run() {
  await dataSource.initialize();

  const stationRepo    = dataSource.getRepository(Station);
  const sensorRepo     = dataSource.getRepository(Sensor);
  const sensorDataRepo = dataSource.getRepository(SensorData);

  // ── Station ───────────────────────────────────────────────────────────────
  let station = await stationRepo.findOne({ where: { name: 'Station Stream Test' } });
  if (!station) {
    station = stationRepo.create({
      name:         'Station Stream Test',
      location:     'Test — stream verification',
      latitude:     36.8,
      longitude:    10.2,
      capacity:     1000,
      capacityUnit: 'm3/day',
      type:         StationType.MONITORING,
      status:       StationStatus.NORMAL,
      description:  'Stream test station for custom-calc interpolation verification.',
    });
    station = await stationRepo.save(station);
  }
  console.log('\n══════════════════════════════════════════════════');
  console.log(' AquaFlow — Stream test seed');
  console.log('══════════════════════════════════════════════════');
  console.log(`Station       : ${station.name}`);
  console.log(`Station ID    : ${station.id}`);

  // ── Sensor A ──────────────────────────────────────────────────────────────
  let sensorA = await sensorRepo.findOne({ where: { name: 'Stream Temperature' } });
  if (!sensorA) {
    sensorA = sensorRepo.create({
      name:          'Stream Temperature',
      type:          SensorType.TEMPERATURE,
      unit:          '°C',
      location:      'Stream zone A',
      minThreshold:  0,
      maxThreshold:  100,
      status:        SensorStatus.ACTIVE,
      alertEnabled:  true,
      lastReading:   18,
      lastReadingAt: min(9),
      station,
      deviceId:      'AQF-STREAM-TEMP',
      serialNumber:  'SN-STREAM-001',
    });
    sensorA = await sensorRepo.save(sensorA);
  }
  await sensorDataRepo.delete({ sensor: { id: sensorA.id } });
  await sensorDataRepo.save(
    STREAM_A.map(p => sensorDataRepo.create({ sensor: sensorA!, value: p.value, timestamp: p.timestamp, source: 'stream-test' }))
  );

  console.log(`\nSensor A      : ${sensorA.name}  (variable a)`);
  console.log(`Sensor A ID   : ${sensorA.id}`);
  console.log('  Readings (every 60 s):');
  STREAM_A.forEach(p =>
    console.log(`    ${p.timestamp.toISOString().substr(11, 8)} UTC → ${String(p.value).padStart(2)} °C`)
  );

  // ── Sensor B ──────────────────────────────────────────────────────────────
  let sensorB = await sensorRepo.findOne({ where: { name: 'Stream Pressure' } });
  if (!sensorB) {
    sensorB = sensorRepo.create({
      name:          'Stream Pressure',
      type:          SensorType.PRESSURE,
      unit:          'bar',
      location:      'Stream zone B',
      minThreshold:  0,
      maxThreshold:  30,
      status:        SensorStatus.ACTIVE,
      alertEnabled:  true,
      lastReading:   19,
      lastReadingAt: sec(570),
      station,
      deviceId:      'AQF-STREAM-PRES',
      serialNumber:  'SN-STREAM-002',
    });
    sensorB = await sensorRepo.save(sensorB);
  }
  await sensorDataRepo.delete({ sensor: { id: sensorB.id } });
  await sensorDataRepo.save(
    STREAM_B.map(p => sensorDataRepo.create({ sensor: sensorB!, value: p.value, timestamp: p.timestamp, source: 'stream-test' }))
  );

  console.log(`\nSensor B      : ${sensorB.name}  (variable b)`);
  console.log(`Sensor B ID   : ${sensorB.id}`);
  console.log('  Readings (every 60 s, offset +30 s):');
  STREAM_B.forEach(p =>
    console.log(`    ${p.timestamp.toISOString().substr(11, 8)} UTC → ${String(p.value).padStart(2)} bar`)
  );

  // ── Manual calculation ────────────────────────────────────────────────────
  const manualPoints = [
    { t: 'T+0m', a:  0, b:  1, sum:  1 },
    { t: 'T+1m', a:  2, b:  2, sum:  4 },
    { t: 'T+2m', a:  4, b:  4, sum:  8 },
    { t: 'T+3m', a:  6, b:  6, sum: 12 },
    { t: 'T+4m', a:  8, b:  8, sum: 16 },
    { t: 'T+5m', a: 10, b: 10, sum: 20 },
    { t: 'T+6m', a: 12, b: 12, sum: 24 },
    { t: 'T+7m', a: 14, b: 14, sum: 28 },
    { t: 'T+8m', a: 16, b: 16, sum: 32 },
    { t: 'T+9m', a: 18, b: 18, sum: 36 },
  ];

  const total = manualPoints.reduce((s, p) => s + p.sum, 0);
  const mean  = total / manualPoints.length;

  console.log('\n──────────────────────────────────────────────────');
  console.log(' Manual calculation  (formula: a + b)');
  console.log(' Strategy: interpolate   |   Aggregation: mean');
  console.log('──────────────────────────────────────────────────');
  console.log('  t        a    b (interp)   a+b');
  manualPoints.forEach(p =>
    console.log(`  ${p.t}  ${String(p.a).padStart(2)}   ${String(p.b).padStart(2)}           ${String(p.sum).padStart(3)}`)
  );
  console.log(`                             ───`);
  console.log(`  sum =                      ${total}`);
  console.log(`  mean = ${total} / ${manualPoints.length} = ${mean}`);
  console.log('\n  ✅ Expected custom-calc result : 18.1');
  console.log('──────────────────────────────────────────────────');
  console.log('\nConfigure custom-calc in the builder with:');
  console.log(`  sensorA          : ${sensorA.id}`);
  console.log(`  sensorB          : ${sensorB.id}`);
  console.log('  formula          : a + b');
  console.log('  timeMode         : all_data');
  console.log('  resampleStrategy : interpolate');
  console.log('  aggregation      : mean');
  console.log('══════════════════════════════════════════════════\n');
}

run()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });
