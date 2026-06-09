# AquaFlow — Complete Architecture Guide

> **Version 2.0** — reflects all implemented modules including the Big Data Pipeline, Operator Workbench Analytics, and extended Workflow Builder.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Folder Structure](#2-folder-structure)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Backend Architecture](#4-backend-architecture)
5. [Database Design](#5-database-design)
6. [Real-Time Architecture](#6-real-time-architecture)
7. [Big Data Pipeline](#7-big-data-pipeline)
8. [Analytics — Operator Workbench](#8-analytics--operator-workbench)
9. [Workflow Builder Architecture](#9-workflow-builder-architecture)
10. [API Routes — Complete Reference](#10-api-routes--complete-reference)
11. [Authentication & RBAC](#11-authentication--rbac)
12. [Infrastructure & Docker](#12-infrastructure--docker)
13. [Performance & Scalability](#13-performance--scalability)
14. [Design Decisions & Trade-offs](#14-design-decisions--trade-offs)

---

## 1. System Overview

AquaFlow is a three-layer system extended with a fourth big-data layer:

```
Layer 1 — Presentation
  React 18 SPA  (Reactstrap · Redux Toolkit · Chart.js 2 · JointJS · Leaflet)

Layer 2 — Application
  NestJS 10 API (TypeORM · Socket.io · MQTT.js · KafkaJS · JWT)

Layer 3 — Data
  TimescaleDB (primary + time-series)   Redis (cache)

Layer 4 — Big Data
  Apache Kafka 3.6 (KRaft)  →  MinIO (S3 data lake)
  PySpark 3.5 (batch + streaming)  →  TimescaleDB sensor_aggregates
```

### Design principles

- **Preserve, then extend**: the original JointJS workflow builder is kept intact; AquaFlow features are additions, not replacements.
- **Real-time first**: every sensor reading flows through WebSocket to the browser in under 500 ms.
- **Graceful degradation**: every backend query has a plain-SQL fallback when TimescaleDB-specific functions are unavailable.
- **Business language in the UI**: the Analytics dashboard exposes zero technical terms (no "Kafka", "Spark", "consumer").
- **Modular monolith**: NestJS modules are fully decoupled; future extraction to microservices is straightforward.

---

## 2. Folder Structure

```
pfe-project/
│
├── backend/                        NestJS 10 API
│   ├── src/
│   │   ├── main.ts                 Bootstrap, Swagger, CORS, validation pipe
│   │   ├── app.module.ts           Root module — imports all feature modules
│   │   │
│   │   ├── auth/                   JWT strategy, refresh tokens, guards
│   │   ├── users/                  User CRUD, role management
│   │   ├── stations/               Station CRUD, pagination, search
│   │   ├── sensors/                Sensor CRUD, cache (Redis 60 s), data ingestion
│   │   ├── alerts/                 Alert creation, threshold evaluation, lifecycle
│   │   ├── maintenance/            Intervention lifecycle, technician assignment
│   │   ├── iot/                    MQTT client, topic routing, payload validation
│   │   ├── realtime/               Socket.io gateway, room management
│   │   ├── analytics/              8 endpoints, TimescaleDB + fallback queries
│   │   ├── reports/                PDF / Excel generation
│   │   ├── notifications/          In-app + email notification delivery
│   │   ├── flows/                  Workflow CRUD, execution orchestration
│   │   ├── execution/              BFS engine + 23 handler classes
│   │   ├── kafka/                  KafkaConsumerService (reads sensors.anomalies)
│   │   └── database/
│   │       ├── entities/           TypeORM entity classes
│   │       └── migrations/         TypeORM migration files
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                       React 18 SPA
│   ├── src/
│   │   ├── App.jsx                 Root component, router setup
│   │   ├── routes.js               All route definitions
│   │   │
│   │   ├── modules/                Feature modules
│   │   │   ├── auth/               Login, register, token refresh
│   │   │   ├── dashboard/          KPI cards, alert feed, overview
│   │   │   ├── stations/           Station list, form, detail, map
│   │   │   ├── monitoring/         Live sensor gauges, WebSocket feed
│   │   │   ├── alerts/             Alert list, acknowledge, history
│   │   │   ├── maintenance/        Intervention CRUD, timeline
│   │   │   ├── analytics/          Operator Workbench (4-tab)
│   │   │   │   ├── pages/
│   │   │   │   │   └── AnalyticsPage.jsx       Tab shell + header
│   │   │   │   └── components/
│   │   │   │       ├── OverviewTab.jsx          Tab 1
│   │   │   │       ├── AnomaliesTab.jsx         Tab 2
│   │   │   │       ├── TrendsTab.jsx            Tab 3
│   │   │   │       └── StationDetailTab.jsx     Tab 4
│   │   │   ├── reports/            Report builder, export
│   │   │   ├── iot/                Device management
│   │   │   ├── automation/         Workflow builder (JointJS)
│   │   │   └── notifications/      Notification centre
│   │   │
│   │   ├── store/                  Redux Toolkit store
│   │   │   ├── store.js            configureStore
│   │   │   └── slices/
│   │   │       ├── authSlice.js
│   │   │       ├── stationsSlice.js
│   │   │       ├── sensorsSlice.js
│   │   │       ├── alertsSlice.js
│   │   │       ├── maintenanceSlice.js
│   │   │       ├── analyticsSlice.js   ← 9 thunks, 20+ selectors
│   │   │       └── realtimeSlice.js
│   │   │
│   │   ├── services/               Axios API wrappers
│   │   │   ├── apiClient.js        Base Axios instance + interceptors
│   │   │   ├── analyticsService.js
│   │   │   ├── sensorService.js
│   │   │   ├── stationService.js
│   │   │   └── ...
│   │   │
│   │   ├── hooks/                  Custom React hooks
│   │   │   └── useSocket.js        Socket.io connection management
│   │   │
│   │   ├── engine/                 Workflow builder client engine
│   │   │   ├── graphSerializer.js
│   │   │   ├── graphDeserializer.js
│   │   │   ├── autosaveManager.js
│   │   │   └── workflowExecutorClient.js
│   │   │
│   │   ├── registry/               Block registry for the builder
│   │   │   ├── blockRegistry.js
│   │   │   └── blockFactory.js
│   │   │
│   │   └── data/
│   │       └── blocks.js           23 block definitions
│   │
│   ├── Dockerfile
│   └── public/
│
├── data-pipeline/                  Python / PySpark data pipeline
│   ├── Dockerfile                  kafka-to-minio archiver image
│   ├── requirements.txt
│   ├── consumer.py                 Kafka → Parquet → MinIO archiver
│   └── spark_jobs/
│       ├── Dockerfile              bitnami/spark:3.5 + S3A JARs
│       ├── base_job.py             Smoke test (reads MinIO, prints schema)
│       ├── aggregate_sensor_kpis.py Batch KPI aggregation → TimescaleDB
│       └── streaming_anomaly_detector.py  Structured streaming z-score
│
├── postgres/
│   └── init/
│       ├── 01_extensions.sql       TimescaleDB, uuid-ossp
│       ├── 02_hypertable.sql       sensor_data hypertable + continuous aggregates
│       └── 03_sensor_aggregates.sql sensor_aggregates table + indexes
│
├── mosquitto/
│   └── config/mosquitto.conf
│
├── docker-compose.yml              Dev — all 13 services
├── docker-compose.prod.yml         Prod — Nginx reverse proxy, tighter limits
└── docs/
    ├── general-blocks-guide.md
    └── industrial-blocks-guide.md
```

---

## 3. Frontend Architecture

### Module structure

Each feature module follows the same convention:

```
modules/<feature>/
├── pages/           Route-level components (loaded by React Router)
├── components/      Presentational sub-components
├── hooks/           Module-specific hooks (optional)
└── index.js         Module barrel export
```

### State management

Redux Toolkit with `createSlice` + `createAsyncThunk`:

```
store/slices/analyticsSlice.js   ← most complex; 9 thunks, 20+ selectors
store/slices/alertsSlice.js
store/slices/authSlice.js
...
```

All API calls go through `services/apiClient.js` which:
- Attaches `Authorization: Bearer <token>` to every request
- Intercepts 401 → triggers silent refresh → retries once
- On second 401 → dispatches `logout`

### Chart library constraint

**Chart.js v2.9.4 + react-chartjs-2 v2.11.2** — this is the version in `package.json`.

- Use `cutoutPercentage` not `cutout` (v3 name)
- Use `scales.xAxes[{}]` arrays, not `scales.x` objects (v3 name)
- Use `legend` not `plugins.legend` (v3 name)
- `HorizontalBar` is a separate component (merged into `Bar` with `indexAxis` in v3)
- Do **not** install or import chart.js v3+ — it will break all charts

### WebSocket integration

`hooks/useSocket.js` manages the Socket.io lifecycle:
- Connects on mount using the token from `localStorage`
- Dispatches Redux actions on `sensor-update`, `alert-created`, `workflow-completed`
- Cleans up on unmount / token expiry

---

## 4. Backend Architecture

### NestJS module map

```
AppModule
├── DatabaseModule           TypeORM + TimescaleDB entities
├── AuthModule               JWT, Passport, refresh token rotation
├── UsersModule              CRUD, role management
├── StationsModule           CRUD, pagination, cache
├── SensorsModule            CRUD, Redis cache (60 s list), data ingestion
├── AlertsModule             Rule evaluation, lifecycle, history
├── MaintenanceModule        Intervention CRUD, assignment
├── IotModule                MQTT.js client, topic routing
├── RealtimeModule           Socket.io gateway
├── AnalyticsModule          8 endpoints, dual-query strategy
├── ReportsModule            PDFMake / ExcelJS
├── NotificationsModule      In-app + email
├── FlowsModule              Workflow CRUD + execution
│   └── ExecutionModule      BFS engine, 23 handlers
└── KafkaModule              KafkaConsumerService (sensors.anomalies)
```

### Analytics service — dual-query strategy

Every query that touches TimescaleDB-specific objects has a fallback:

```typescript
// Pattern used in analytics.service.ts
try {
  // Try TimescaleDB continuous aggregate (fast)
  return await this.dataSource.query(`
    SELECT time_bucket('1 hour', ...) FROM sensor_data_hourly ...
  `);
} catch {
  // Fall back to plain PostgreSQL (slower but always works)
  return await this.dataSource.query(`
    SELECT DATE_TRUNC('hour', timestamp) FROM sensor_data ...
  `);
}
```

This means the application works on plain PostgreSQL too — TimescaleDB just makes it faster.

### KafkaConsumerService

```typescript
// Subscribes to sensors.anomalies
// Parses z-score, rollingMean, rollingStddev, value from message
// Creates an Alert entity with data JSONB = { zScore, rollingMean, rollingStddev, value }
// Broadcasts via Socket.io → browser shows real-time alert
```

---

## 5. Database Design

### Entity Relationship

```
users ──< stations ──< sensors ──< sensor_data   (hypertable)
                  │         │
                  └──< alerts ──────────── sensors
                  │
                  └──< maintenance
                  │
                  └──< workflows ──< workflow_executions

sensors ──< sensor_aggregates   (Spark-computed KPIs)
users   ──< notifications
```

### TimescaleDB specifics

```sql
-- sensor_data is a hypertable (auto time-partitioned by timestamp)
SELECT create_hypertable('sensor_data', 'timestamp',
  chunk_time_interval => INTERVAL '1 day');

-- Continuous aggregate: hourly bucket
CREATE MATERIALIZED VIEW sensor_data_hourly
  WITH (timescaledb.continuous) AS
  SELECT
    time_bucket('1 hour', timestamp)   AS bucket,
    sensor_id,
    AVG(value)                         AS avg_value,
    MIN(value)                         AS min_value,
    MAX(value)                         AS max_value,
    STDDEV(value)                      AS stddev_value,
    COUNT(*)                           AS reading_count
  FROM sensor_data
  GROUP BY bucket, sensor_id;

-- Continuous aggregate: daily bucket
CREATE MATERIALIZED VIEW sensor_data_daily
  WITH (timescaledb.continuous) AS
  SELECT time_bucket('1 day', timestamp) AS bucket, ... ;
```

### sensor_aggregates table (Spark output)

```sql
CREATE TABLE sensor_aggregates (
  sensor_id       UUID          NOT NULL,
  bucket          TIMESTAMPTZ   NOT NULL,
  granularity     VARCHAR(10)   NOT NULL,   -- 'hourly' | 'daily'
  station_id      UUID,
  avg_value       DOUBLE PRECISION,
  min_value       DOUBLE PRECISION,
  max_value       DOUBLE PRECISION,
  stddev_value    DOUBLE PRECISION,
  reading_count   BIGINT,
  anomaly_flag    BOOLEAN DEFAULT FALSE,
  rolling_mean    DOUBLE PRECISION,
  rolling_stddev  DOUBLE PRECISION,
  computed_at     TIMESTAMPTZ   NOT NULL,
  PRIMARY KEY (sensor_id, bucket, granularity)
);
CREATE INDEX ON sensor_aggregates (station_id, bucket);
CREATE INDEX ON sensor_aggregates (sensor_id, granularity, bucket);
```

### Alert.data JSONB — anomaly payload

When the Spark streaming detector flags an anomaly:

```json
{
  "zScore":        3.14,
  "rollingMean":   4.2,
  "rollingStddev": 0.8,
  "value":         6.7
}
```

This JSONB is stored in `alerts.data` and surfaced in the Anomaly Detection tab.

---

## 6. Real-Time Architecture

```
IoT Sensor
    │ MQTT publish
    ▼
Mosquitto broker  (port 1883)
    │ subscribe sensors/+/data
    ▼
NestJS IotModule (MQTT.js client)
    │ validate payload
    ├──► SensorsService.updateLastReading()   → sensor_data table
    ├──► AlertsService.evaluateThresholds()   → create Alert if violated
    ├──► RealtimeGateway.broadcastSensorUpdate()  → Socket.io rooms
    └──► KafkaProducer.send('sensors.readings')   → Kafka pipeline
              │
              ▼
    Browser (React)
    Socket.io 'sensor-update' event
    → Redux realtimeSlice.sensorUpdate
    → Live gauge updates, chart appends
```

Socket.io rooms:
- `sensor:{id}` — clients watching a specific sensor
- `station:{id}` — clients watching a station's dashboard
- `alerts` — all connected clients (alert broadcasts)

---

## 7. Big Data Pipeline

### Full data flow

```
NestJS Backend
    │  KafkaJS producer
    ▼
Kafka topic: sensors.readings
    │           │
    │           └──────────────────────────────────────────┐
    │                                                      │
    ▼                                                      ▼
kafka-to-minio (Python)                     spark-anomaly-detector (PySpark)
- Batches 500 msgs or 60 s                  - Structured Streaming
- Writes Parquet to:                        - 5-min sliding window (1-min slide)
  MinIO raw/sensors/                        - Computes z-score per sensor
  YYYY/MM/DD/HH/batch_N.parquet            - Flags abs(z) ≥ 2.5
                                            - Writes JSON to:
                                              Kafka: sensors.anomalies
                                                       │
                                            NestJS KafkaConsumerService
                                            - Parses anomaly message
                                            - Creates Alert (type=anomaly)
                                            - Broadcasts via Socket.io

(periodic / on demand)
MinIO raw/sensors/
    │
    ▼
aggregate_sensor_kpis.py  (PySpark batch)
- Reads all Parquet from MinIO
- Computes per-sensor per-bucket:
    avg, min, max, stddev, count
    anomaly_flag (2σ rule)
    rolling_mean, rolling_stddev
- Writes results to:
    MinIO processed/hourly/  (Parquet)
    MinIO processed/daily/   (Parquet)
    TimescaleDB sensor_aggregates (UPSERT)
```

### Kafka topic schema

```json
// sensors.readings (published by NestJS backend)
{
  "sensorId": "uuid",
  "stationId": "uuid",
  "value": 4.2,
  "unit": "bar",
  "type": "pressure",
  "timestamp": "2026-06-09T10:00:00.000Z"
}

// sensors.anomalies (published by spark-anomaly-detector)
{
  "sensorId": "uuid",
  "stationId": "uuid",
  "windowStart": "2026-06-09T09:55:00.000Z",
  "windowEnd": "2026-06-09T10:00:00.000Z",
  "avgValue": 6.7,
  "rollingMean": 4.2,
  "rollingStddev": 0.8,
  "zScore": 3.14,
  "readingCount": 12
}
```

### Spark streaming — anomaly detection logic

```python
# streaming_anomaly_detector.py — core logic (simplified)
window_df = (
    readings_df
    .withWatermark("timestamp", "2 minutes")
    .groupBy(
        window("timestamp", "5 minutes", "1 minute"),
        "sensorId"
    )
    .agg(
        avg("value").alias("avg_value"),
        count("value").alias("reading_count"),
        avg("value").alias("rolling_mean"),
        stddev("value").alias("rolling_stddev"),
    )
)

anomalies = window_df.filter(
    abs((col("avg_value") - col("rolling_mean")) / col("rolling_stddev")) >= 2.5
)
```

---

## 8. Analytics — Operator Workbench

### Architecture

```
AnalyticsPage.jsx      (tab shell, header KPI cards, freshness banner)
├── OverviewTab.jsx    (Tab 1)
├── AnomaliesTab.jsx   (Tab 2)
├── TrendsTab.jsx      (Tab 3)
└── StationDetailTab.jsx (Tab 4)

analyticsSlice.js      (Redux slice)
├── 9 async thunks:
│   fetchAnalyticsOverview, fetchAnalyticsSensors,
│   fetchSensorStats, fetchStationStatus,
│   fetchAnomalyTimeline, fetchNetworkTrend,
│   fetchDataFreshness, fetchKpis, fetchSystemMetrics
├── State organised by tab (overview, anomaly, trends, sensorStats)
└── 20+ selectors exported

analyticsService.js    (Axios wrappers for all 9 endpoints)
```

### Data flow per tab

**Tab 1 — Overview**
- On mount: `fetchStationStatus` + `fetchNetworkTrend(6)` + `fetchDataFreshness`
- `selectStationStatus` → Station Health Grid cards
- Chart data: doughnuts from station/alert counts; line from `selectNetworkTrend`

**Tab 2 — Anomaly Detection**
- On tab switch OR period change: `fetchAnomalyTimeline({hours, limit})` + `fetchKpis({granularity, hours})`
- `selectAnomalyTimeline` → `[{ id, type, severity, createdAt, zScore, station, sensor }]`
- `selectAnalyticsKpis` → `{ rows: [{sensorId, anomalyFlag, rollingMean, ...}] }`

**Tab 3 — Trends & History**
- On tab switch OR period change: `fetchNetworkTrend(N)` + `fetchSystemMetrics(N)` + `fetchAnomalyTimeline({hours:N})`
- Predictive outlook cards computed **client-side** from the three data sources (no ML needed)

**Tab 4 — Station Detail**
- Station list: `selectStationStatus`
- Sensor list: `selectAnalyticsSensors` filtered by `sensor.station.id === selectedStationId`
- Station history: direct `analyticsService.getStationHistory()` call → local state (no Redux thunk needed)
- Sensor stats: `fetchSensorStats({sensorId, params})` → `selectAnalyticsSensorStats`

### Backend analytics endpoints

```
GET /analytics/overview
  → { totalStations, activeSensors, openAlerts, maintenancePending,
      stationsByStatus, alertsBySeverity }

GET /analytics/station-status
  → [{ id, name, status, totalSensors, activeSensors, offlineSensors,
       faultySensors, openAlerts, lastReadingAt }]

GET /analytics/anomaly-timeline?hours=24&limit=100
  → [{ id, type, severity, status, message, createdAt,
       zScore, rollingMean, rollingStddev, value,
       station:{id,name}, sensor:{id,name,unit,type} }]

GET /analytics/network-trend?hours=6
  → [{ time, avgValue, readingCount }]

GET /analytics/data-freshness
  → { monitoringActive, lastReadingAt, totalMeasurements, source }

GET /analytics/kpis?granularity=hourly&hours=24
  → { granularity, windowHours, from, totalBuckets, totalAnomalies,
      anomalyByStation:{}, rows:[...] }

GET /analytics/system-metrics?hours=24
  → { windowHours, from, totalReadings, source,
      topSensors:[{ sensorId, totalReadings, avgValue }] }

GET /analytics/sensors/:id/stats?from&to&granularity
  → { sensor:{id,name,unit,type,status,minThreshold,maxThreshold,station},
      period:{from,to,granularity},
      stats:{avg,min,max,count,stddev},
      timeSeries:[{time,avg,min,max,stddev,count}] }

GET /analytics/stations/:id/history?from&to&granularity
  → { station:{id,name,status},
      period:{from,to,granularity},
      sensors:[{sensorId,sensorName,unit,buckets:[{time,avg,min,max,stddev,count}]}] }
```

---

## 9. Workflow Builder Architecture

### Component map

```
Frontend
├── BuilderPage.jsx             Main UI: sidebar + canvas + properties panel
├── hooks/useWorkflowEditor.js  Top-level state (selected node, zoom, etc.)
├── hooks/useJointGraph.js      JointJS canvas lifecycle
├── engine/
│   ├── graphSerializer.js      JointJS graph → JSON (for API save)
│   ├── graphDeserializer.js    JSON → JointJS graph (on load)
│   ├── autosaveManager.js      Debounced save to localStorage
│   └── workflowExecutorClient.js  POST /api/flows/:id/execute
├── registry/
│   ├── blockRegistry.js        { type → BlockDefinition } map
│   └── blockFactory.js         Creates JointJS cells from definitions
└── data/blocks.js              23 block definitions (575 lines)

Backend
├── flows/
│   ├── flows.controller.ts     GET/POST/PUT/DELETE + execute endpoint
│   ├── flows.service.ts        CRUD, Workflow entity
│   └── flow-executor.service.ts  Orchestrates BFS execution
└── execution/
    ├── engine/
    │   └── execution-context.ts  Shared state across handlers
    └── handlers/               One file per block type (23 handlers)
        ├── sensor-trigger.handler.ts
        ├── alert-sender.handler.ts
        ├── maintenance-creator.handler.ts
        ├── mqtt-publisher.handler.ts
        └── ... (19 more)
```

### Execution engine — BFS traversal

```typescript
// flow-executor.service.ts (simplified)
async executeWorkflow(workflowId: string, context: ExecutionContext) {
  const graph = await this.flowsService.getGraph(workflowId);
  const startNode = graph.nodes.find(n => n.type === 'start');

  const queue = [startNode];
  while (queue.length) {
    const node = queue.shift();
    const handler = this.handlerRegistry.get(node.type);
    const output = await handler.handle(node, context.getInput(node.id), context);
    context.setOutput(node.id, output);

    const nextNodes = graph.getSuccessors(node.id);
    queue.push(...nextNodes);
  }
}
```

### Block definition schema

```javascript
// data/blocks.js — one entry per block type
{
  type:        "alert-sender",           // unique identifier
  title:       "Alert Sender",           // displayed in sidebar
  icon:        "fa-exclamation-triangle",
  category:    "Industrial",             // "General" | "Industrial"
  description: "Creates an alert",
  color:       "#ef4444",
  inputs:  [{ id: "in",  label: "Trigger" }],
  outputs: [{ id: "out", label: "Alert Sent" }],
  properties: [
    { name: "severity", label: "Severity", type: "select",
      options: ["low","medium","high","critical"], defaultValue: "medium" },
    { name: "message",  label: "Message",  type: "textarea", defaultValue: "" },
  ],
}
```

---

## 10. API Routes — Complete Reference

### Auth  `POST /api/auth/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Create account |
| POST | `/auth/login` | public | Get access + refresh tokens |
| POST | `/auth/refresh` | refresh token | Rotate access token |
| POST | `/auth/logout` | JWT | Invalidate refresh token |
| GET | `/auth/me` | JWT | Current user profile |

### Stations  `/api/stations`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/stations` | all | Paginated list (`?page&limit&search&status`) |
| POST | `/stations` | admin, operator | Create |
| GET | `/stations/:id` | all | Detail with sensors |
| PUT | `/stations/:id` | admin, operator | Update |
| DELETE | `/stations/:id` | admin | Delete |

### Sensors  `/api/sensors`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/sensors` | all | Paginated (`?stationId&type&status`) |
| POST | `/sensors` | admin, operator | Create |
| GET | `/sensors/:id` | all | Detail |
| PUT | `/sensors/:id` | admin, operator | Update |
| DELETE | `/sensors/:id` | admin | Delete |
| GET | `/sensors/:id/data` | all | Raw readings (`?from&to&limit`) |
| POST | `/sensors/:id/inject` | admin, operator | Inject test reading |

### Alerts  `/api/alerts`

| Method | Path | Description |
|---|---|---|
| GET | `/alerts` | List (`?severity&status&stationId&limit`) |
| POST | `/alerts` | Create manually |
| PATCH | `/alerts/:id/acknowledge` | Acknowledge |
| PATCH | `/alerts/:id/resolve` | Resolve |
| DELETE | `/alerts/:id` | Delete |

### Maintenance  `/api/maintenance`

| Method | Path | Description |
|---|---|---|
| GET | `/maintenance` | List interventions |
| POST | `/maintenance` | Create intervention |
| GET | `/maintenance/:id` | Detail |
| PATCH | `/maintenance/:id` | Update status / notes |
| PATCH | `/maintenance/:id/assign` | Assign technician |

### Workflows  `/api/flows`

| Method | Path | Description |
|---|---|---|
| GET | `/flows` | List workflows |
| POST | `/flows` | Create |
| GET | `/flows/:id` | Detail with graph JSON |
| PUT | `/flows/:id` | Update graph |
| DELETE | `/flows/:id` | Delete |
| POST | `/flows/:id/execute` | Trigger execution |
| GET | `/flows/:id/executions` | Execution history |

### Analytics  `/api/analytics`

| Method | Path | Query params |
|---|---|---|
| GET | `/analytics/overview` | — |
| GET | `/analytics/station-status` | — |
| GET | `/analytics/anomaly-timeline` | `hours` `limit` |
| GET | `/analytics/network-trend` | `hours` |
| GET | `/analytics/data-freshness` | — |
| GET | `/analytics/kpis` | `granularity` `hours` |
| GET | `/analytics/system-metrics` | `hours` |
| GET | `/analytics/sensors/:id/stats` | `from` `to` `granularity` |
| GET | `/analytics/stations/:id/history` | `from` `to` `granularity` |
| GET | `/analytics/pipeline/stats` | — |

---

## 11. Authentication & RBAC

### Token flow

```
POST /auth/login
  → { access_token (JWT 1h), refresh_token (JWT 7d) }

Frontend: stores both in memory / localStorage
On 401: POST /auth/refresh → new access_token (transparent to user)
On second 401: logout + redirect to /login
```

### JWT payload

```json
{ "sub": "user-uuid", "email": "user@example.com", "role": "operator", "iat": 0, "exp": 0 }
```

### Role matrix

| Endpoint group | admin | operator | technician | analyst |
|---|---|---|---|---|
| Auth (own profile) | ✅ | ✅ | ✅ | ✅ |
| Stations (read) | ✅ | ✅ | ✅ | ✅ |
| Stations (write) | ✅ | ✅ | — | — |
| Sensors (read) | ✅ | ✅ | ✅ | ✅ |
| Sensors (write) | ✅ | ✅ | — | — |
| Alerts (read) | ✅ | ✅ | ✅ | ✅ |
| Alerts (acknowledge) | ✅ | ✅ | ✅ | — |
| Maintenance (read) | ✅ | ✅ | ✅ | ✅ |
| Maintenance (create) | ✅ | ✅ | — | — |
| Maintenance (update own) | ✅ | ✅ | ✅ | — |
| Analytics (read) | ✅ | ✅ | ✅ | ✅ |
| Workflows (execute) | ✅ | ✅ | — | — |
| User management | ✅ | — | — | — |

---

## 12. Infrastructure & Docker

### Service dependency graph

```
postgres (healthy)
redis    (healthy)
mosquitto (healthy)
kafka    (healthy)   ← depends on nothing (KRaft, standalone)
minio    (healthy)
    │
minio-init (completes) ← creates bucket structure
    │
backend (healthy)    ← depends on all 5 above
    │
kafka-to-minio       ← depends on kafka + minio-init
spark-master         ← depends on minio
spark-worker         ← depends on spark-master
spark-anomaly        ← depends on spark-master + spark-worker + kafka
frontend             ← depends on backend
```

### Health checks

| Service | Health check command | Interval |
|---|---|---|
| postgres | `pg_isready -U postgres` | 10 s |
| redis | `redis-cli ping` | 10 s |
| mosquitto | `mosquitto_pub -h localhost -t health/check -m ok` | 10 s |
| kafka | `kafka-topics.sh --bootstrap-server localhost:9092 --list` | 15 s |
| minio | `curl -sf http://localhost:9000/minio/health/live` | 15 s |
| backend | `wget -qO- http://localhost:3001/api/health` | 30 s |

### Production docker-compose differences

`docker-compose.prod.yml` adds / changes:
- Nginx reverse proxy (80/443) in front of frontend and backend
- `SPARK_WORKER_MEMORY=4G` and `SPARK_WORKER_CORES=4`
- `NODE_ENV=production` → TypeORM `synchronize: false`
- Volumes bind to named volumes instead of local paths
- Secrets loaded from Docker secrets instead of plain env vars

---

## 13. Performance & Scalability

### Current performance targets (development)

| Metric | Target |
|---|---|
| Dashboard initial load | < 2 s |
| REST API response (p95) | < 100 ms |
| WebSocket sensor update latency | < 500 ms |
| TimescaleDB hourly aggregate query | < 20 ms |
| Raw `sensor_data` query (no aggregate) | < 100 ms |

### Bottlenecks and mitigations

| Bottleneck | Mitigation |
|---|---|
| Sensor list queries repeated per user | Redis cache 60 s (SensorsService) |
| `sensor_data` table grows unbounded | TimescaleDB auto-compression (configurable) |
| Analytics queries on large datasets | Continuous aggregates (`sensor_data_hourly`) |
| Kafka consumer lag | kafka-to-minio batches 500 msgs or 60 s, whichever first |
| Spark job resource pressure | Worker memory configurable via compose env |

### Horizontal scaling path

- **Backend**: stateless NestJS — add instances behind Nginx upstream
- **WebSocket**: sticky sessions or Redis adapter for Socket.io
- **Kafka**: add partitions (default: 3)
- **Spark**: add worker containers

---

## 14. Design Decisions & Trade-offs

### TimescaleDB over plain PostgreSQL
- **Pro**: `time_bucket()` is 10–100× faster than `DATE_TRUNC` on large time-series; continuous aggregates maintained automatically
- **Con**: adds a DB extension dependency
- **Mitigation**: every query has a plain-SQL `DATE_TRUNC` fallback

### Kafka over direct DB writes
- **Pro**: decouples IoT ingestion from analytics; replay-able; multiple consumers
- **Con**: adds operational complexity (Kafka, kafka-to-minio)
- **Mitigation**: KRaft mode (no Zookeeper); single-node fine for ≤ 10 000 msg/s

### MinIO (S3) as data lake
- **Pro**: immutable raw data archive; Spark reads Parquet directly from S3A
- **Con**: another stateful service to manage
- **Trade-off accepted**: enables future ML training on historical data

### Chart.js v2 (not v3)
- **Reason**: the existing project already had react-chartjs-2 v2.11.2; upgrading is a breaking change affecting all chart configurations
- **Impact**: `HorizontalBar` is a separate component; `scales.xAxes[]` array syntax; `cutoutPercentage` not `cutout`
- **Decision**: stay on v2 for stability; upgrade is a separate future task

### Redux for analytics (not React Query)
- **Reason**: analytics data is shared across the 4-tab UI; server-state cache would be per-component
- **Trade-off**: more boilerplate slice code vs. simpler cache invalidation

### JointJS for workflow canvas (preserved from original)
- **Reason**: existing working implementation; re-writing in React Flow would be a large risk
- **Impact**: JointJS is a class-based library — must be used in non-React lifecycle hooks

---

*Last updated: 2026-06-09 · AquaFlow v2.0*
