/**
 * seed-strategy-tests.ts
 *
 * Insère 4 scénarios de test pour vérifier les stratégies de
 * synchronisation temporelle du bloc custom-calc.
 *
 * ══════════════════════════════════════════════════════════════════════
 * TEST 1 — forward_fill  (Zero-Order Hold)
 * ══════════════════════════════════════════════════════════════════════
 * Sensor A (rapide, 1 lecture/10s) :
 *   T+0s→10  T+10s→20  T+20s→30  T+30s→40  T+40s→50  T+50s→60
 * Sensor B (lent,  1 lecture/30s) :
 *   T+0s→2   T+30s→5
 *
 * Formula : a * b   |   strategy : forward_fill   |   aggregation : mean
 *
 *   t=T+0  : a=10  b=hold(2)=2  → 10×2 =  20
 *   t=T+10 : a=20  b=hold(2)=2  → 20×2 =  40
 *   t=T+20 : a=30  b=hold(2)=2  → 30×2 =  60
 *   t=T+30 : a=40  b=hold(5)=5  → 40×5 = 200   ← B se met à jour
 *   t=T+40 : a=50  b=hold(5)=5  → 50×5 = 250
 *   t=T+50 : a=60  b=hold(5)=5  → 60×5 = 300
 *   sum = 870   mean = 870/6 = 145.0
 *
 *   ✅ Expected : 145.0
 *
 * ══════════════════════════════════════════════════════════════════════
 * TEST 2 — interpolate  (Interpolation linéaire)
 * ══════════════════════════════════════════════════════════════════════
 * Sensor A (rapide, constant=10) :
 *   T+0s→10  T+10s→10  T+20s→10  T+30s→10  T+40s→10  T+50s→10
 * Sensor B (lent, linéaire, 1 lecture/30s) :
 *   T+0s→0   T+30s→6   T+60s→12
 *
 * Formula : a * b   |   strategy : interpolate   |   aggregation : mean
 *
 *   t=T+0  : a=10  b=0.0  (exact)          → 10×0  =   0
 *   t=T+10 : a=10  b=0+(10/30)×6=2.0       → 10×2  =  20
 *   t=T+20 : a=10  b=0+(20/30)×6=4.0       → 10×4  =  40
 *   t=T+30 : a=10  b=6.0  (exact)          → 10×6  =  60
 *   t=T+40 : a=10  b=6+(10/30)×6=8.0       → 10×8  =  80
 *   t=T+50 : a=10  b=6+(20/30)×6=10.0      → 10×10 = 100
 *   sum = 300   mean = 300/6 = 50.0
 *
 *   ✅ Expected : 50.0
 *
 * ══════════════════════════════════════════════════════════════════════
 * TEST 3 — downsample  (Agrégation par bucket)
 * ══════════════════════════════════════════════════════════════════════
 * Sensor A (rapide, 3 lectures/bucket) :
 *   T+0s→2  T+10s→4  T+20s→6  |  T+30s→8  T+40s→10  T+50s→12
 * Sensor B (lent = grille, 1 lecture/30s) :
 *   T+0s→10   T+30s→20
 *
 * Formula : a + b   |   strategy : downsample (mean)   |   aggregation : mean
 *
 *   B est la grille de référence (plus lent = avg interval = 30s > 10s)
 *   bucket 1 [T+0, T+30) : A_mean=(2+4+6)/3=4,  B=10 → 4+10 = 14
 *   bucket 2 [T+30, T+60): A_mean=(8+10+12)/3=10, B=20 → 10+20 = 30
 *   mean = (14+30)/2 = 22.0
 *
 *   ✅ Expected : 22.0
 *
 * ══════════════════════════════════════════════════════════════════════
 * TEST 4 — last_n_minutes  (Fenêtre glissante)
 * ══════════════════════════════════════════════════════════════════════
 * Sensor A (toutes les 2 min, données récentes) :
 *   NOW-9m→10  NOW-7m→20  NOW-5m→30  NOW-3m→40  NOW-1m→50
 * Sensor B (toutes les 5 min, données récentes) :
 *   NOW-10m→1  NOW-5m→6  NOW-0m→11
 *
 * Formula : a + b   |   timeMode : last_n_minutes=6
 * strategy : interpolate   |   aggregation : mean
 *
 * Avec last_n_minutes=6, on ne garde que les 6 dernières minutes :
 *   A inclus : NOW-5m(30), NOW-3m(40), NOW-1m(50)
 *   B inclus : NOW-5m(6),  NOW-0m(11)         ← NOW-10m exclu ✓
 *
 * A est référence (3 points > 2 points).
 * Interpolation de B à chaque timestamp A :
 *   NOW-5m : a=30  b=6.0  (exact)
 *            → 30+6 = 36
 *   NOW-3m : b=interp entre (NOW-5m,6) et (NOW-0m,11) à NOW-3m
 *            ratio=(5-3)/(5-0)=2/5=0.4
 *            b=6+0.4×5=8.0  → 40+8 = 48
 *   NOW-1m : ratio=(5-1)/(5-0)=4/5=0.8
 *            b=6+0.8×5=10.0 → 50+10 = 60
 *   mean = (36+48+60)/3 = 144/3 = 48.0
 *
 *   ✅ Expected : 48.0
 *
 * Usage:
 *   docker compose exec backend npm run build
 *   docker compose exec -e NODE_ENV=development backend \
 *     node dist/database/seeds/seed-strategy-tests.js
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Alert }              from '../entities/Alert.entity';
import { Maintenance }        from '../entities/Maintenance.entity';
import { Notification }       from '../entities/Notification.entity';
import { Sensor, SensorStatus, SensorType } from '../entities/Sensor.entity';
import { SensorData }         from '../entities/SensorData.entity';
import { Station, StationStatus, StationType } from '../entities/Station.entity';
import { User }               from '../entities/User.entity';
import { Workflow }           from '../entities/Workflow.entity';
import { WorkflowExecution }  from '../entities/WorkflowExecution.entity';

const ds = new DataSource({
  type:        'postgres',
  host:        process.env.DATABASE_HOST     || 'localhost',
  port:        Number(process.env.DATABASE_PORT || 5432),
  username:    process.env.DATABASE_USER     || 'postgres',
  password:    process.env.DATABASE_PASSWORD || 'postgres',
  database:    process.env.DATABASE_NAME     || 'aquaflow',
  entities:    [User, Station, Sensor, SensorData, Alert, Maintenance,
                Workflow, WorkflowExecution, Notification],
  synchronize: process.env.NODE_ENV !== 'production',
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const FIXED_BASE = new Date('2026-06-09T10:00:00.000Z');
const atSec  = (s: number) => new Date(FIXED_BASE.getTime() + s * 1000);
const agoMin = (m: number) => new Date(Date.now() - m * 60_000);

async function upsertStation(stationRepo: any, name: string): Promise<any> {
  let s = await stationRepo.findOne({ where: { name } });
  if (!s) {
    s = await stationRepo.save(stationRepo.create({
      name, location: 'Test strategy verification',
      latitude: 36.8, longitude: 10.2,
      capacity: 1000, capacityUnit: 'm3/day',
      type: StationType.MONITORING, status: StationStatus.NORMAL,
      description: 'Auto-created by seed-strategy-tests.',
    }));
  }
  return s;
}

async function upsertSensor(
  sensorRepo: any, name: string, type: SensorType, unit: string,
  station: any, deviceId: string, lastReading: number, lastReadingAt: Date,
): Promise<any> {
  let s = await sensorRepo.findOne({ where: { name } });
  if (!s) {
    s = await sensorRepo.save(sensorRepo.create({
      name, type, unit, station, deviceId,
      serialNumber: `SN-${deviceId}`,
      location: 'Test zone', minThreshold: 0, maxThreshold: 9999,
      status: SensorStatus.ACTIVE, alertEnabled: false,
      lastReading, lastReadingAt,
    }));
  }
  return s;
}

async function replaceReadings(
  sdrRepo: any, sensor: any,
  points: { timestamp: Date; value: number }[],
): Promise<void> {
  await sdrRepo.delete({ sensor: { id: sensor.id } });
  await sdrRepo.save(points.map(p =>
    sdrRepo.create({ sensor, value: p.value, timestamp: p.timestamp, source: 'strategy-test' })
  ));
}

function header(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(` ${title}`);
  console.log('═'.repeat(60));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await ds.initialize();
  const stationRepo = ds.getRepository(Station);
  const sensorRepo  = ds.getRepository(Sensor);
  const sdrRepo     = ds.getRepository(SensorData);

  // ── TEST 1 : forward_fill ─────────────────────────────────────────────────
  header('TEST 1 — forward_fill (Zero-Order Hold)');
  const st1 = await upsertStation(stationRepo, 'Station Test ForwardFill');
  const A1 = await upsertSensor(sensorRepo, 'FF_SensorA_Temperature', SensorType.TEMPERATURE,
    '°C', st1, 'AQF-FF-A', 60, atSec(50));
  const B1 = await upsertSensor(sensorRepo, 'FF_SensorB_Pressure', SensorType.PRESSURE,
    'bar', st1, 'AQF-FF-B', 5, atSec(30));

  await replaceReadings(sdrRepo, A1, [
    { timestamp: atSec(0),  value: 10 },
    { timestamp: atSec(10), value: 20 },
    { timestamp: atSec(20), value: 30 },
    { timestamp: atSec(30), value: 40 },
    { timestamp: atSec(40), value: 50 },
    { timestamp: atSec(50), value: 60 },
  ]);
  await replaceReadings(sdrRepo, B1, [
    { timestamp: atSec(0),  value: 2 },
    { timestamp: atSec(30), value: 5 },
  ]);

  console.log(`sensorA ID : ${A1.id}  (6 pts, every 10s, values: 10→60)`);
  console.log(`sensorB ID : ${B1.id}  (2 pts, every 30s, values: 2, 5)`);
  console.log('\nManual steps  (formula: a * b):');
  console.log('  t=T+0s  a=10  b=hold(2)=2   → 10×2  =  20');
  console.log('  t=T+10s a=20  b=hold(2)=2   → 20×2  =  40');
  console.log('  t=T+20s a=30  b=hold(2)=2   → 30×2  =  60');
  console.log('  t=T+30s a=40  b=hold(5)=5   → 40×5  = 200  ← B updated');
  console.log('  t=T+40s a=50  b=hold(5)=5   → 50×5  = 250');
  console.log('  t=T+50s a=60  b=hold(5)=5   → 60×5  = 300');
  console.log('  sum=870  mean=870/6 = 145.0');
  console.log('\n  ✅ Expected result : 145.0');
  console.log('\nBuilder config:');
  console.log(`  formula: a * b  |  sensorA: ${A1.id}  |  sensorB: ${B1.id}`);
  console.log('  timeMode: all_data  |  resampleStrategy: forward_fill  |  aggregation: mean');

  // ── TEST 2 : interpolate ──────────────────────────────────────────────────
  header('TEST 2 — interpolate (Interpolation linéaire)');
  const st2 = await upsertStation(stationRepo, 'Station Test Interpolate');
  const A2 = await upsertSensor(sensorRepo, 'INTERP_SensorA_Temperature', SensorType.TEMPERATURE,
    '°C', st2, 'AQF-INT-A', 10, atSec(50));
  const B2 = await upsertSensor(sensorRepo, 'INTERP_SensorB_Pressure', SensorType.PRESSURE,
    'bar', st2, 'AQF-INT-B', 12, atSec(60));

  await replaceReadings(sdrRepo, A2, [
    { timestamp: atSec(0),  value: 10 },
    { timestamp: atSec(10), value: 10 },
    { timestamp: atSec(20), value: 10 },
    { timestamp: atSec(30), value: 10 },
    { timestamp: atSec(40), value: 10 },
    { timestamp: atSec(50), value: 10 },
  ]);
  await replaceReadings(sdrRepo, B2, [
    { timestamp: atSec(0),  value:  0 },
    { timestamp: atSec(30), value:  6 },
    { timestamp: atSec(60), value: 12 },
  ]);

  console.log(`sensorA ID : ${A2.id}  (6 pts, every 10s, constant=10)`);
  console.log(`sensorB ID : ${B2.id}  (3 pts, every 30s, linear: 0→6→12)`);
  console.log('\nManual steps  (formula: a * b):');
  console.log('  t=T+0s  a=10  b=0+(0/30)×6=0.0   → 10×0  =   0');
  console.log('  t=T+10s a=10  b=0+(10/30)×6=2.0  → 10×2  =  20');
  console.log('  t=T+20s a=10  b=0+(20/30)×6=4.0  → 10×4  =  40');
  console.log('  t=T+30s a=10  b=6.0 (exact)       → 10×6  =  60');
  console.log('  t=T+40s a=10  b=6+(10/30)×6=8.0  → 10×8  =  80');
  console.log('  t=T+50s a=10  b=6+(20/30)×6=10.0 → 10×10 = 100');
  console.log('  sum=300  mean=300/6 = 50.0');
  console.log('\n  ✅ Expected result : 50.0');
  console.log('\nBuilder config:');
  console.log(`  formula: a * b  |  sensorA: ${A2.id}  |  sensorB: ${B2.id}`);
  console.log('  timeMode: all_data  |  resampleStrategy: interpolate  |  aggregation: mean');

  // ── TEST 3 : downsample ───────────────────────────────────────────────────
  header('TEST 3 — downsample (Agrégation par bucket)');
  const st3 = await upsertStation(stationRepo, 'Station Test Downsample');
  const A3 = await upsertSensor(sensorRepo, 'DOWN_SensorA_Flow', SensorType.FLOW,
    'm3/h', st3, 'AQF-DOWN-A', 12, atSec(50));
  const B3 = await upsertSensor(sensorRepo, 'DOWN_SensorB_Level', SensorType.LEVEL,
    '%', st3, 'AQF-DOWN-B', 20, atSec(30));

  await replaceReadings(sdrRepo, A3, [
    { timestamp: atSec(0),  value:  2 },
    { timestamp: atSec(10), value:  4 },
    { timestamp: atSec(20), value:  6 },
    { timestamp: atSec(30), value:  8 },
    { timestamp: atSec(40), value: 10 },
    { timestamp: atSec(50), value: 12 },
  ]);
  await replaceReadings(sdrRepo, B3, [
    { timestamp: atSec(0),  value: 10 },
    { timestamp: atSec(30), value: 20 },
  ]);

  console.log(`sensorA ID : ${A3.id}  (6 pts, every 10s, values: 2→12)`);
  console.log(`sensorB ID : ${B3.id}  (2 pts, every 30s, values: 10, 20)`);
  console.log('\nManual steps  (formula: a + b, downsampleAgg: mean):');
  console.log('  B = grille de référence (avg interval=30s > 10s)');
  console.log('  bucket1 [T+0,T+30): A_pts=[2,4,6]  A_mean=4   B=10 → 4+10=14');
  console.log('  bucket2 [T+30,T+60):A_pts=[8,10,12] A_mean=10  B=20 → 10+20=30');
  console.log('  mean = (14+30)/2 = 22.0');
  console.log('\n  ✅ Expected result : 22.0');
  console.log('\nBuilder config:');
  console.log(`  formula: a + b  |  sensorA: ${A3.id}  |  sensorB: ${B3.id}`);
  console.log('  timeMode: all_data  |  resampleStrategy: downsample');
  console.log('  downsampleAgg: mean  |  aggregation: mean');

  // ── TEST 4 : last_n_minutes ───────────────────────────────────────────────
  header('TEST 4 — last_n_minutes (Fenêtre glissante)');
  const st4 = await upsertStation(stationRepo, 'Station Test LastNMin');
  const A4 = await upsertSensor(sensorRepo, 'LNM_SensorA_Temperature', SensorType.TEMPERATURE,
    '°C', st4, 'AQF-LNM-A', 50, agoMin(1));
  const B4 = await upsertSensor(sensorRepo, 'LNM_SensorB_Chlorine', SensorType.CHLORINE,
    'mg/L', st4, 'AQF-LNM-B', 11, agoMin(0));

  await replaceReadings(sdrRepo, A4, [
    { timestamp: agoMin(9), value: 10 },  // ← hors fenêtre si last_n_min=6
    { timestamp: agoMin(7), value: 20 },  // ← hors fenêtre
    { timestamp: agoMin(5), value: 30 },  // ← inclus
    { timestamp: agoMin(3), value: 40 },  // ← inclus
    { timestamp: agoMin(1), value: 50 },  // ← inclus
  ]);
  await replaceReadings(sdrRepo, B4, [
    { timestamp: agoMin(10), value:  1 }, // ← hors fenêtre si last_n_min=6
    { timestamp: agoMin(5),  value:  6 }, // ← inclus
    { timestamp: agoMin(0),  value: 11 }, // ← inclus
  ]);

  console.log(`sensorA ID : ${A4.id}  (5 pts, toutes les 2min, NOW-9m→NOW-1m)`);
  console.log(`sensorB ID : ${B4.id}  (3 pts, toutes les 5min, NOW-10m→NOW)`);
  console.log('\nAvec last_n_minutes=6, seulement les 6 dernières minutes :');
  console.log('  A inclus : NOW-5m(30), NOW-3m(40), NOW-1m(50)  [NOW-9m et NOW-7m exclus]');
  console.log('  B inclus : NOW-5m(6),  NOW-0m(11)              [NOW-10m exclu]');
  console.log('\nManual steps  (formula: a + b, interpolate):');
  console.log('  A = référence (3 pts > 2 pts)');
  console.log('  NOW-5m: a=30  b=6.0 (exact)                    → 30+6  = 36');
  console.log('  NOW-3m: a=40  b=6+((5-3)/(5-0))×5=6+2=8.0    → 40+8  = 48');
  console.log('  NOW-1m: a=50  b=6+((5-1)/(5-0))×5=6+4=10.0   → 50+10 = 60');
  console.log('  mean = (36+48+60)/3 = 144/3 = 48.0');
  console.log('\n  ✅ Expected result : 48.0');
  console.log('\nBuilder config:');
  console.log(`  formula: a + b  |  sensorA: ${A4.id}  |  sensorB: ${B4.id}`);
  console.log('  timeMode: last_n_minutes  |  periodMinutes: 6');
  console.log('  resampleStrategy: interpolate  |  aggregation: mean');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(' RÉSUMÉ DES 4 TESTS');
  console.log('═'.repeat(60));
  console.log(' Test 1  forward_fill  formula: a*b  → Expected: 145.0');
  console.log(' Test 2  interpolate   formula: a*b  → Expected:  50.0');
  console.log(' Test 3  downsample    formula: a+b  → Expected:  22.0');
  console.log(' Test 4  last_n_min=6  formula: a+b  → Expected:  48.0');
  console.log('═'.repeat(60));
}

run()
  .catch(err => { console.error('Seed failed:', err); process.exitCode = 1; })
  .finally(async () => { if (ds.isInitialized) await ds.destroy(); });
