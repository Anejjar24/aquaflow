# AquaFlow — Industrial Water Station Supervision Platform

> **Version 2.0** · NestJS 10 · React 18 · TimescaleDB · Kafka · Spark · MinIO

AquaFlow is a production-grade SCADA-inspired platform for drinking-water facility management. It combines real-time IoT monitoring, intelligent automation, a big-data analytics pipeline, and a visual workflow builder into a single unified application.

---

## Table of Contents

1. [What is AquaFlow?](#1-what-is-aquaflow)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Technology Stack](#3-technology-stack)
4. [Docker Services Map](#4-docker-services-map)
5. [Feature Modules](#5-feature-modules)
6. [Analytics — Operator Workbench](#6-analytics--operator-workbench)
7. [Big Data Pipeline](#7-big-data-pipeline)
8. [Workflow Builder](#8-workflow-builder)
9. [API Reference](#9-api-reference)
10. [Database Schema](#10-database-schema)
11. [Security & RBAC](#11-security--rbac)
12. [Getting Started (5 minutes)](#12-getting-started-5-minutes)
13. [Default Credentials & Ports](#13-default-credentials--ports)
14. [Environment Variables](#14-environment-variables)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. What is AquaFlow?

AquaFlow gives water-utility operators a single pane of glass over their entire sensor network:

| Capability | What it does |
|---|---|
| **Live Monitoring** | Sub-second WebSocket updates from MQTT sensors |
| **Intelligent Alerts** | Threshold rules + AI-grade z-score anomaly detection |
| **Visual Automation** | Drag-and-drop workflow builder with 23 industrial block types |
| **Big-Data Analytics** | Kafka → MinIO data lake → PySpark KPIs → TimescaleDB |
| **Operator Workbench** | 4-tab analytics dashboard: Overview, Anomalies, Trends, Station Detail |
| **Maintenance** | Full intervention lifecycle (create → assign → resolve) |
| **GIS Map** | Leaflet station map with live status indicators |
| **Reporting** | PDF / Excel export with customisable templates |
| **Role-Based Access** | Admin · Operator · Technician · Analyst |

---

## 2. Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser  (React 18 + Redux Toolkit + Reactstrap + Chart.js 2)   │
│  Modules: Dashboard · Stations · Monitoring · Alerts ·           │
│           Analytics (Operator Workbench) · Automation · Reports  │
└───────────────────┬──────────────────────────────────────────────┘
                    │  REST /api  +  WebSocket (Socket.io)
┌───────────────────▼──────────────────────────────────────────────┐
│  Backend  (NestJS 10 · TypeScript · TypeORM)                     │
│  Auth · Stations · Sensors · Alerts · Analytics · Flows ·        │
│  IoT (MQTT) · Realtime Gateway · Kafka Consumer                  │
└──────┬──────────┬────────────┬──────────────┬────────────────────┘
       │          │            │              │
  ┌────▼────┐ ┌──▼───┐ ┌─────▼──────┐ ┌────▼───────┐
  │TimescaleDB│ │Redis │ │ Mosquitto  │ │   Kafka    │
  │(PostgreSQL│ │  7   │ │  MQTT 2   │ │  3.6 KRaft │
  │ + TSB ext)│ │cache │ │  broker   │ │  (no ZK)   │
  └──────────┘ └──────┘ └────────────┘ └─────┬──────┘
                                              │
              ┌───────────────────────────────▼──────────────────┐
              │            Big Data Pipeline                      │
              │  kafka-to-minio ──► MinIO (S3 data lake)         │
              │                         │                         │
              │              PySpark 3.5 (batch + streaming)      │
              │              aggregate KPIs  │  anomaly detector  │
              │                         ▼                         │
              │              TimescaleDB sensor_aggregates        │
              └──────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Package | Version | Role |
|---|---|---|
| React | 18.2 | UI framework |
| Redux Toolkit | latest | Global state |
| Reactstrap | 8 | Bootstrap 4 components |
| Chart.js | **2.9.4** | Charts (v2 API) |
| react-chartjs-2 | **2.11.2** | Chart components |
| React Leaflet | 3 | GIS station map |
| Socket.io-client | 4 | Real-time WebSocket |
| Axios | latest | HTTP client |
| JointJS | 3 | Workflow canvas |
| React Router | 6 | SPA routing |

### Backend

| Package | Version | Role |
|---|---|---|
| NestJS | 10 | Server framework |
| TypeORM | 0.3 | ORM / migrations |
| Passport + JWT | latest | Authentication |
| Socket.io | 4 | WebSocket gateway |
| MQTT.js | 5 | Mosquitto client |
| KafkaJS | 2 | Kafka producer / consumer |
| node-minio | latest | MinIO SDK |
| Class-validator | latest | DTO validation |
| Jest | 29 | Unit tests |

### Infrastructure

| Service | Image | Purpose |
|---|---|---|
| TimescaleDB | `timescale/timescaledb:2.14.2-pg15` | Primary database + time-series |
| Redis | `redis:7-alpine` | Cache (60 s sensor list) |
| Mosquitto | `eclipse-mosquitto:2` | MQTT IoT broker |
| Kafka | `bitnami/kafka:3.6` | Event streaming (KRaft, no ZK) |
| MinIO | `minio/minio:latest` | S3-compatible data lake |
| Spark | `bitnami/spark:3.5` | Batch KPIs + streaming anomaly |

---

## 4. Docker Services Map

| Container | Image | Ports | Purpose |
|---|---|---|---|
| `aquaflow-postgres` | TimescaleDB 2.14 | 5432 | Primary DB |
| `aquaflow-redis` | Redis 7 | 6379 | API cache |
| `aquaflow-mosquitto` | Mosquitto 2 | 1883, 9001 (WS) | MQTT broker |
| `aquaflow-kafka` | Bitnami Kafka 3.6 | 9092 | Event bus |
| `aquaflow-minio` | MinIO | 9000 (API), **9002** (console) | Data lake |
| `aquaflow-minio-init` | MinIO MC | — | Creates bucket structure (one-shot) |
| `aquaflow-backend` | NestJS build | **3001** | REST API + WebSocket |
| `aquaflow-kafka-to-minio` | Python archiver | — | Kafka → Parquet on MinIO |
| `aquaflow-spark-master` | Bitnami Spark 3.5 | **8080** (UI), 7077 | Spark master |
| `aquaflow-spark-worker` | Bitnami Spark 3.5 | — | Spark worker (1 GB / 2 cores) |
| `aquaflow-spark-anomaly` | Bitnami Spark 3.5 | — | Streaming anomaly detector |
| `aquaflow-frontend` | Nginx + React build | **3000** | SPA |

MinIO bucket layout created by `minio-init`:
```
aquaflow-lake/
├── raw/sensors/          ← Parquet archives from Kafka
├── processed/hourly/     ← Spark hourly KPI output
├── processed/daily/      ← Spark daily KPI output
└── models/               ← Reserved for future ML artefacts
```

---

## 5. Feature Modules

### Authentication
- JWT access token (1 h) + refresh token (7 d)
- bcrypt password hashing
- Four roles: `admin` · `operator` · `technician` · `analyst`
- Every API endpoint is guard-protected

### Dashboard
- KPI cards: total stations, active sensors, open alerts, pending maintenance
- Live alert feed via WebSocket
- Station status summary

### Stations
- Full CRUD with pagination and search
- GPS coordinates stored (lat/lon)
- Linked sensors, alerts, maintenance history
- Interactive Leaflet map with colour-coded status pins

### Real-Time Monitoring
- Live sensor readings pushed via Socket.io (`sensor-update` events)
- Animated gauge widgets
- Multi-sensor comparison view
- <500 ms end-to-end latency (MQTT → WS → browser)

### Alerts
- Threshold-based auto-generation (min/max per sensor)
- z-score anomaly alerts from the Spark streaming detector
- Severity levels: `info` · `warning` · `error` · `critical`
- Acknowledge / resolve workflow
- Full history with filtering

### Maintenance
- Intervention lifecycle: `scheduled` → `in_progress` → `completed`
- Technician assignment
- Notes and history timeline

### IoT Device Management
- MQTT topic: `sensors/{sensorId}/data`
- Payload validation and sensor linkage
- Device status tracking

### Reports
- PDF and Excel export
- Customisable date-range and station filters

### Notifications
- In-app notification centre
- Email / SMS delivery (pluggable)

---

## 6. Analytics — Operator Workbench

The Analytics module is a **4-tab Operator Workbench** — a unified business-oriented dashboard with zero technical jargon visible to the end user.

### Global header (always visible)
- 4 KPI cards: Monitoring Stations · Active Sensors · Open Alerts · Scheduled Maintenance
- Pulsing green dot + "Last measurement: X min ago" live freshness banner

### Tab 1 — Overview
| Panel | Data source |
|---|---|
| Stations by Status (doughnut) | `GET /analytics/station-status` |
| Alerts by Severity (doughnut) | Alert store |
| Station Health Grid | Per-station cards with sensor health bar + alert badges |
| 6-Hour Network Activity (line) | `GET /analytics/network-trend` |
| Recent Alert Feed | Last 10 alerts, scrollable |

### Tab 2 — Anomaly Detection
| Panel | Data source |
|---|---|
| Period selector (24 h / 7 d / 30 d) | re-fetches on change |
| 4 summary stat cards | derived from timeline |
| Events by Station (horizontal bar) | `GET /analytics/anomaly-timeline` |
| Events by Type (horizontal bar) | same |
| Chronological event timeline (table) | severity colour, z-score column |
| Statistical anomaly detail (table) | `GET /analytics/kpis` (Spark) — graceful empty |

### Tab 3 — Trends & History
| Panel | Data source |
|---|---|
| Network Activity line chart | `GET /analytics/network-trend?hours=N` |
| Top Sensors by Volume (horizontal bar) | `GET /analytics/system-metrics` |
| Network Outlook (heuristic insight cards) | computed client-side |
| Event Frequency over Time (bar) | anomaly timeline grouped by day/hour |

### Tab 4 — Station Detail
| Panel | Data source |
|---|---|
| Station picker + period toggle | `selectStationStatus` |
| Station health KPI cards + progress bar | same |
| All-sensors trend chart (multi-line) | `GET /analytics/stations/:id/history` |
| Sensor picker (filtered by station) | `selectAnalyticsSensors` |
| Sensor KPI cards (avg / min / max / stddev) | `GET /analytics/sensors/:id/stats` |
| Sensor detail chart — avg line + min/max band + threshold dashes | same |
| Station event history table | anomaly timeline filtered by station |

---

## 7. Big Data Pipeline

```
IoT devices
    │  MQTT
    ▼
Eclipse Mosquitto
    │
    ▼
NestJS Backend ──► Kafka topic: sensors.readings
                            │
          ┌─────────────────┴──────────────────┐
          │                                    │
          ▼                                    ▼
  kafka-to-minio                  spark-anomaly-detector
  (Python archiver)               (PySpark Structured Streaming)
  Parquet → MinIO                 5-min sliding window, 1-min slide
  raw/sensors/                    z-score ≥ 2.5 → sensors.anomalies
                                            │
          ┌─────────────────────────────────┘
          ▼
  NestJS KafkaConsumerService
  reads sensors.anomalies → creates Alert in TimescaleDB
          │
  (periodic / manual)
          ▼
  aggregate_sensor_kpis.py  (PySpark batch job)
  reads raw/ Parquet → avg/min/max/stddev/anomaly_flag
  writes → MinIO processed/  +  TimescaleDB sensor_aggregates
```

### Kafka topics

| Topic | Producer | Consumer(s) |
|---|---|---|
| `sensors.readings` | NestJS backend | kafka-to-minio, spark-anomaly-detector |
| `sensors.anomalies` | spark-anomaly-detector | NestJS KafkaConsumerService |

### MinIO data lake paths

| Path | Format | Written by |
|---|---|---|
| `raw/sensors/` | Parquet | kafka-to-minio archiver |
| `processed/hourly/` | Parquet | aggregate_sensor_kpis.py |
| `processed/daily/` | Parquet | aggregate_sensor_kpis.py |

### TimescaleDB tables

| Table | Type | Description |
|---|---|---|
| `sensor_data` | hypertable | Raw readings (timestamp, sensor_id, value) |
| `sensor_data_hourly` | continuous aggregate | Hourly pre-aggregation |
| `sensor_data_daily` | continuous aggregate | Daily pre-aggregation |
| `sensor_aggregates` | regular table | Spark-computed KPIs per bucket |

### PySpark jobs

| Script | Mode | Trigger |
|---|---|---|
| `base_job.py` | batch (smoke test) | manual spark-submit |
| `aggregate_sensor_kpis.py` | batch | manual / scheduled cron |
| `streaming_anomaly_detector.py` | structured streaming | always-on via docker service |

---

## 8. Workflow Builder

The Workflow Builder is a **visual drag-and-drop automation editor** built on JointJS.

### How it works
1. Operator drags blocks onto the canvas and connects them
2. Graph is serialised to JSON and saved via `POST /api/flows`
3. Backend traverses the graph (BFS) and runs each node's handler
4. Real-time execution log streams back via WebSocket

### Block categories

**General blocks (9)**
`Start` · `End` · `Condition` · `Delay` · `HTTP Request` · `Email` · `Log` · `Variable Set` · `Variable Get`

**Industrial blocks (14)**
`Sensor Trigger` · `Alert Sender` · `Maintenance Creator` · `MQTT Publisher` · `Station Status Update` · `Sensor Data Reader` · `Threshold Check` · `Notification Sender` · `Report Generator` · `Data Aggregator` · `Schedule Trigger` · `Webhook` · `Data Transform` · `Multi-Condition`

### Trigger types

| Type | How |
|---|---|
| Manual | Click **Execute** in the UI |
| Scheduled | Cron expression stored on the workflow |
| Sensor Threshold | MQTT `sensors/+/data` event fires when value crosses threshold |

### Backend execution
- `FlowExecutorService` orchestrates BFS graph traversal
- Each block type has a dedicated `Handler` class in `backend/src/execution/handlers/`
- Execution logs persisted to `WorkflowExecution` entity
- Errors isolated per-node; execution continues on non-critical failures

---

## 9. API Reference

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
```

### Stations
```
GET    /api/stations          ?page &limit &search &status
POST   /api/stations
GET    /api/stations/:id
PUT    /api/stations/:id
DELETE /api/stations/:id
```

### Sensors
```
GET    /api/sensors           ?stationId &type &status &limit
POST   /api/sensors
GET    /api/sensors/:id
PUT    /api/sensors/:id
DELETE /api/sensors/:id
GET    /api/sensors/:id/data  ?from &to &limit
```

### Alerts
```
GET    /api/alerts            ?severity &status &stationId &limit
POST   /api/alerts
GET    /api/alerts/:id
PATCH  /api/alerts/:id/acknowledge
PATCH  /api/alerts/:id/resolve
DELETE /api/alerts/:id
```

### Maintenance
```
GET    /api/maintenance
POST   /api/maintenance
GET    /api/maintenance/:id
PATCH  /api/maintenance/:id
PATCH  /api/maintenance/:id/assign
```

### Workflows (Automation)
```
GET    /api/flows
POST   /api/flows
GET    /api/flows/:id
PUT    /api/flows/:id
DELETE /api/flows/:id
POST   /api/flows/:id/execute
GET    /api/flows/:id/executions
```

### Analytics — Operator Workbench
```
GET    /api/analytics/overview
GET    /api/analytics/station-status
GET    /api/analytics/anomaly-timeline   ?hours &limit
GET    /api/analytics/network-trend      ?hours
GET    /api/analytics/data-freshness
GET    /api/analytics/kpis               ?granularity &hours
GET    /api/analytics/system-metrics     ?hours
GET    /api/analytics/sensors/:id/stats  ?from &to &granularity
GET    /api/analytics/stations/:id/history ?from &to &granularity
GET    /api/analytics/pipeline/stats
```

### Health
```
GET    /api/health
```

---

## 10. Database Schema

### Core entities

| Entity | Table | Key columns |
|---|---|---|
| User | `users` | id, email, password (bcrypt), role, firstname, lastname |
| Station | `stations` | id, name, location, latitude, longitude, status, type |
| Sensor | `sensors` | id, name, type, unit, minThreshold, maxThreshold, status, station_id |
| SensorData | `sensor_data` | id, sensor_id, value, timestamp — **TimescaleDB hypertable** |
| Alert | `alerts` | id, type, severity, status, message, data (jsonb), station_id, sensor_id |
| Maintenance | `maintenance` | id, title, status, assignedTo, stationId, scheduledAt |
| Workflow | `workflows` | id, name, graph (jsonb), trigger, cronExpression |
| WorkflowExecution | `workflow_executions` | id, workflow_id, status, log (jsonb), startedAt, finishedAt |
| SensorAggregate | `sensor_aggregates` | (sensor_id, bucket, granularity) PK, avg/min/max/stddev/anomaly_flag |
| Notification | `notifications` | id, userId, message, read, createdAt |

### TimescaleDB-specific objects

```sql
-- Hypertable (auto time-partitioning)
SELECT create_hypertable('sensor_data', 'timestamp');

-- Continuous aggregates
CREATE MATERIALIZED VIEW sensor_data_hourly WITH (timescaledb.continuous) AS
  SELECT time_bucket('1 hour', timestamp) AS bucket,
         sensor_id, AVG(value) avg_value, ...;

CREATE MATERIALIZED VIEW sensor_data_daily WITH (timescaledb.continuous) AS
  SELECT time_bucket('1 day', timestamp) AS bucket, ...;
```

---

## 11. Security & RBAC

| Role | Stations | Sensors | Alerts | Maintenance | Analytics | Admin |
|---|---|---|---|---|---|---|
| **admin** | ✅ full | ✅ full | ✅ full | ✅ full | ✅ full | ✅ |
| **operator** | ✅ read/write | ✅ read/write | ✅ ack | ✅ create | ✅ full | — |
| **technician** | ✅ read | ✅ read | ✅ read | ✅ update own | ✅ read | — |
| **analyst** | ✅ read | ✅ read | ✅ read | ✅ read | ✅ full | — |

All endpoints protected with `JwtAuthGuard` + `RolesGuard`.

---

## 12. Getting Started (5 minutes)

See **[QUICK_START.md](./QUICK_START.md)** for the complete first-run walkthrough.

### One-liner
```bash
git clone <repo-url> pfe-project && cd pfe-project
cp backend/.env.example backend/.env   # edit JWT_SECRET at minimum
docker-compose up -d
# wait ~45 s for all health-checks to pass
# Frontend  → http://localhost:3000
# API       → http://localhost:3001/api
# MinIO UI  → http://localhost:9002   (aquaflow / aquaflow123)
# Spark UI  → http://localhost:8080
```

---

## 13. Default Credentials & Ports

| Service | URL | Username | Password |
|---|---|---|---|
| **Frontend** | http://localhost:3000 | *(register first)* | — |
| **Backend API** | http://localhost:3001/api | — | — |
| **API docs (Swagger)** | http://localhost:3001/api/docs | — | — |
| **MinIO console** | http://localhost:9002 | `aquaflow` | `aquaflow123` |
| **Spark master UI** | http://localhost:8080 | — | — |
| **PostgreSQL** | localhost:5432 | `postgres` | `postgres` |
| **Redis** | localhost:6379 | — | — |
| **MQTT** | localhost:1883 | — | — |
| **Kafka** | localhost:9092 | — | — |

---

## 14. Environment Variables

### `backend/.env`
```env
# ── Database (TimescaleDB) ───────────────────────────────────────
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=aquaflow

# ── JWT ─────────────────────────────────────────────────────────
JWT_SECRET=change-me-in-production-32chars-minimum
JWT_REFRESH_SECRET=change-me-refresh-in-production-32chars
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=604800

# ── Server ──────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── Redis ───────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379

# ── MQTT ────────────────────────────────────────────────────────
MQTT_BROKER_URL=mqtt://localhost:1883

# ── Kafka ───────────────────────────────────────────────────────
KAFKA_BROKERS=localhost:9092

# ── MinIO (S3 data lake) ────────────────────────────────────────
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=aquaflow
MINIO_SECRET_KEY=aquaflow123
MINIO_BUCKET=aquaflow-lake
```

### `frontend/.env`
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=http://localhost:3001
```

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker-compose up` fails on Kafka | First boot (KRaft init) | `docker-compose restart kafka` |
| Backend exits immediately | DB not ready | `docker-compose up -d --wait` or wait 30 s |
| Analytics shows "No data" everywhere | No sensors reporting | Publish a test MQTT message (see QUICK_START.md §5) |
| Station history 500 error | `time_bucket()` not available | Backend auto-falls back to `DATE_TRUNC`; check TimescaleDB extension |
| MinIO bucket missing | `minio-init` failed | `docker-compose run --rm minio-init` |
| Spark UI blank | Workers not connected | Check `docker-compose logs spark-worker` |
| Chart.js errors in console | Wrong API version used | Project uses **Chart.js v2** — do not import v3 components |
| CORS error from frontend | Wrong `FRONTEND_URL` in backend .env | Set `FRONTEND_URL=http://localhost:3000` |

---

## Documentation Index

| File | Contents |
|---|---|
| **README_AQUAFLOW.md** | This file — full platform reference |
| **QUICK_START.md** | Step-by-step first-run guide |
| **AQUAFLOW_ARCHITECTURE.md** | Deep-dive architecture & design decisions |
| **PROJECT_SETUP.md** | Dev environment setup (Windows/Linux) |
| **WORKFLOW_BUILDER_COMPLETE.md** | Workflow builder technical reference |
| **docs/general-blocks-guide.md** | General workflow block catalogue |
| **docs/industrial-blocks-guide.md** | Industrial workflow block catalogue |

---

*Last updated: 2026-06-09 · AquaFlow v2.0*
