# AquaFlow — Complete Project Summary

**Date:** 2026-05-27  
**Status:** 100% feature-complete — all phases (P1–P4) and all P2 enhancements done  
**Type:** PFE (Final-Year Engineering Project)

---

## What Is It?

**AquaFlow** is a full-stack industrial water-station supervision platform. It provides real-time monitoring, alerting, automation, and management for water distribution infrastructure — stations, sensors, pumps, alerts, maintenance, and programmable workflows.

The platform runs as a single `docker compose up -d` command.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript, Node 20 |
| **Database** | PostgreSQL 15 via TypeORM (9 entities, 1 migration) |
| **Cache** | Redis 7 — auth token denylist + sensor list cache |
| **MQTT** | Eclipse Mosquitto 2 — real-time IoT sensor ingestion |
| **Auth** | JWT access tokens (1h) + refresh tokens (7d) + Redis denylist on logout |
| **Scheduling** | `@nestjs/schedule` — cron-based workflow triggers |
| **Real-time** | Socket.IO — 6 live server→client event types |
| **API Docs** | Swagger/OpenAPI at `/api/docs` |
| **Frontend** | React 18, Redux Toolkit, React Router 6 (CRA) |
| **UI Framework** | Argon Dashboard React — Reactstrap + Bootstrap 4 |
| **Charts** | Chart.js 2 via react-chartjs-2 (Line, Doughnut) |
| **GIS Map** | Leaflet + react-leaflet |
| **Workflow Canvas** | JointJS / @joint/core (drag-and-drop) |
| **Container (dev)** | Docker Compose — 5 services, all ports exposed |
| **Container (prod)** | `docker-compose.prod.yml` — hardened, no infra ports exposed |
| **CI/CD** | GitHub Actions — backend + frontend pipelines |

---

## Architecture

### Backend (`backend/`)

```
NestJS 10 — Port 3001
├── Auth          JWT login/register/refresh/logout/profile
├── Users         CRUD + 4 roles: admin / operator / technician / analyst
├── Stations      CRUD + status broadcasts over WebSocket
├── Sensors       CRUD + Redis cache + manual reading injection
├── Alerts        CRUD + acknowledge/resolve + CSV export + real-time push
├── Maintenance   CRUD work orders with assignedTo, priority, scheduling
├── Analytics     Overview KPIs + per-sensor time-series + station history
├── Notifications In-app bell notifications + email (nodemailer) + WS push
├── Flows         Workflow CRUD + activate/deactivate + execute + history
├── IoT           MQTT ingestion → sensor readings → threshold alert generation
├── Realtime      Socket.IO gateway — authenticated, JWT-validated connections
├── Execution     14-node workflow engine (pump control, MQTT, HTTP, alerts…)
└── Health        GET /api/health — DB + Redis probes, HTTP 503 on degraded
```

**Database entities (9):** User, Station, Sensor, SensorData, Alert, Maintenance, Notification, Workflow, WorkflowExecution

**~52 REST endpoints** across all modules

### Frontend (`frontend/`)

```
React 18 + Redux Toolkit — Port 3000
├── Auth pages         Login, Register, JWT auto-refresh interceptor
├── Dashboard          Live KPI cards + trend charts + real-time feed
├── Stations           Table + Leaflet map toggle + CRUD + detail page
├── Monitoring         Sensor table + filter bar + detail page with live chart
├── Alerts             Table + severity/status filters + detail modal + CSV export
├── Maintenance        Work orders + CRUD modal + priority/status filters
├── Analytics          KPI cards + doughnut charts + sensor time-series analysis
├── Notifications      Bell badge + dropdown + full notification list page
├── Users              User table + role management + activate/deactivate
├── Workflow Builder   JointJS canvas + 14 block types + settings + scheduling
└── Redux Store        11 slices: auth, dashboard, realtime, stations, sensors,
                       alerts, maintenance, ui, notifications, users, analytics
```

### Real-time Flow (Socket.IO)

```
IoT sensor → MQTT → Mosquitto → NestJS IotService
                                      │
                                 saves SensorData
                                 checks thresholds → creates Alert
                                      │
                               RealtimeGateway (Socket.IO)
                                      │
                    ┌─────────────────┼─────────────────┐
               sensor-update    alert-created    station-status
                    │                │                  │
              sensorsSlice     alertsSlice        stationsSlice
              dashboardSlice   dashboardSlice     dashboardSlice
```

---

## Features Built (100% Complete)

### Core Platform

| Feature | Details |
|---------|---------|
| Authentication | Register, login, logout, token refresh, edit profile, Redis denylist |
| RBAC | 4 roles with per-endpoint guards (admin / operator / technician / analyst) |
| Station Management | Full CRUD, status tracking, map view (Leaflet), detail page |
| Sensor Monitoring | Full CRUD, per-type filtering, live last-reading updates, detail page |
| Real-time Live Chart | 50-reading rolling buffer in SensorDetailsPage, `● Live` badge |
| Threshold Alerts | IoT service auto-generates alerts when sensor crosses min/max |
| Alert Management | Table + filters + acknowledge/resolve + detail modal + CSV export |
| Maintenance | Work orders with type/priority/status/assignedTo + filter bar |
| Analytics | Overview KPIs, station-status doughnut, alert-severity doughnut, sensor time-series with avg/min/max/stddev/count |
| Notifications | Bell badge with unread count, dropdown, full page, mark-read, mark-all-read |
| User Management | List users, change roles, deactivate/reactivate (admin only) |

### Workflow Automation Engine

| Feature | Details |
|---------|---------|
| Workflow Builder | JointJS drag-and-drop canvas |
| 14 block types | input, action, decision, delay, output, api (HTTP), notification, sensor-read, threshold-check, pump-control, alert-trigger, mqtt-publish, station-control, http-request |
| Execution engine | Graph traversal, per-node handlers, real dependency injection |
| Persistence | All executions saved to DB with status/duration/output/error/log |
| Execution history | `GET /flows/:id/executions` — last 50 runs |
| Scheduling | Cron-based triggers (`@nestjs/schedule`), configurable per workflow |
| MQTT triggers | Workflows fire automatically when a sensor threshold is crossed |
| Activate/Deactivate | Per-workflow switch enables/disables all triggers |

### Infrastructure & DevOps

| Item | Details |
|------|---------|
| Dev Docker stack | `docker-compose.yml` — PostgreSQL, Redis, Mosquitto, backend, frontend |
| Prod Docker stack | `docker-compose.prod.yml` — no exposed infra ports, auth on all services, CPU/memory limits, log rotation |
| Health endpoint | `GET /api/health` → DB + Redis probes, HTTP 200 / 503 |
| GitHub Actions | `backend-ci.yml` (lint+build+unit+e2e) + `frontend-ci.yml` (CI=true build+Jest) |
| DB migration | Full initial schema — 9 tables, enum types, FK constraints, indexes |
| Seed script | `npm run seed` — 5 stations, 15 sensors, 5 alerts, 4 demo users |
| Swagger | `/api/docs` — all ~52 endpoints documented with auth |

---

## API Endpoints (~52 total)

Base URL: `http://localhost:3001/api`

| Module | Method | Path | Notes |
|--------|--------|------|-------|
| **Auth** | POST | `/auth/register` | Public |
| | POST | `/auth/login` | Public — returns access + refresh tokens |
| | GET | `/auth/me` | Current user |
| | POST | `/auth/logout` | Denylists refresh token |
| | POST | `/auth/refresh` | Rotates token pair |
| | PATCH | `/auth/profile` | Update own name/password |
| **Health** | GET | `/health` | DB + Redis probes, HTTP 503 on degraded |
| **Stations** | GET | `/stations` | Paginated, search/status/type filters |
| | POST/GET/PATCH/DELETE | `/stations/:id` | Full CRUD |
| | GET | `/stations/map` | GIS coordinates for all stations |
| **Sensors** | GET | `/sensors` | Filters: stationId, type, status; Redis-cached |
| | POST/GET/PATCH/DELETE | `/sensors/:id` | Full CRUD |
| | POST | `/sensors/:id/readings` | Manual inject reading |
| | GET | `/sensors/:id/data` | Historical readings |
| | GET | `/sensors/:id/data/export` | CSV download |
| **Alerts** | GET | `/alerts` | Filters: severity, status |
| | POST/GET | `/alerts` / `/alerts/:id` | Create + fetch |
| | PATCH | `/alerts/:id/acknowledge` | Acknowledge |
| | PATCH | `/alerts/:id/resolve` | Resolve |
| | DELETE | `/alerts/:id` | Admin only |
| | GET | `/alerts/export/csv` | CSV download with filters |
| **Maintenance** | GET | `/maintenance` | Filters: status, priority |
| | POST/GET/PATCH/DELETE | `/maintenance/:id` | Full CRUD |
| **Users** | GET | `/users` | Admin only, paginated |
| | GET/PATCH | `/users/:id` | View + update role/status |
| **Analytics** | GET | `/analytics/overview` | System-wide KPIs |
| | GET | `/analytics/sensors/:id/stats` | Avg/min/max/stddev + time-series |
| | GET | `/analytics/stations/:id/history` | Per-sensor history by hour/day |
| **Notifications** | GET | `/notifications` | Paginated list |
| | GET | `/notifications/unread-count` | Badge count |
| | PATCH | `/notifications/:id/read` | Mark one read |
| | PATCH | `/notifications/read-all` | Mark all read |
| **Workflows** | GET/POST | `/flows` | List + create |
| | GET/PATCH/DELETE | `/flows/:id` | Fetch + update + delete |
| | GET | `/flows/:id/executions` | Last 50 execution records |
| | PATCH | `/flows/:id/activate` | Enable triggers |
| | PATCH | `/flows/:id/deactivate` | Disable triggers |
| | POST | `/flows/execute` | Ad-hoc run |

---

## WebSocket Events

| Event (server → client) | Redux action dispatched | Triggered by |
|-------------------------|------------------------|-------------|
| `sensor-update` | `sensorRealtimeReceived` | MQTT reading ingested |
| `station-status` | `stationRealtimeUpdated` | Station PATCH with status |
| `alert-created` | `alertRealtimeReceived` | Threshold exceeded or manual alert |
| `notification-created` | `notificationReceived` | Any backend notification creation |
| `maintenance-update` | `maintenanceRealtimeUpdated` | Maintenance PATCH |
| `system-stats` | `updateSystemStats` | Periodic broadcast |

---

## Redux Store (11 slices)

```javascript
store = {
  auth:          { user, accessToken, refreshToken, loading, error },
  dashboard:     { stations, sensors, alerts, realtimeStats },
  realtime:      { connected, sensorUpdates, alertsReceived, stationStatuses },
  stations:      { items, selectedStation, meta, filters, isLoading, isSaving, error },
  sensors:       { items, meta, isLoading, isSaving, error },
  alerts:        { items, meta, isLoading, error },
  maintenance:   { items, meta, isLoading, isSaving, error },
  ui:            { sidebarMini, theme, notifications },
  notifications: { items, unreadCount, meta, isLoading, error },
  users:         { items, meta, isLoading, error },
  analytics:     { overview, overviewLoading, overviewError,
                   sensors, sensorStats, statsLoading, statsError },
}
```

---

## Development History

| Phase | Work Done | Result |
|-------|-----------|--------|
| **Pre-dev audit** | Found 7 critical bugs, ~30% complete, 4 working pages, no tests | Baseline established |
| **P1 — Critical Fixes** | Fixed all 7 bugs: JWT guards, AlertsPage (0 bytes → full), station-status WS, workflow DB persistence, DB migrations, workflowApi env drift, Redis wiring | ~67% complete |
| **P2 — UI Enhancements** | Sensor/maintenance filter bars, station history chart, alert detail modal, workflow stubs wired, analyticsSlice | ~100% complete |
| **P3 — New Features** | UsersModule + UsersPage, Dashboard trend charts, Workflow scheduling + MQTT triggers, GIS map (Leaflet), CSV export, Real-time live streaming chart | +6 major features |
| **P4 — DevOps** | Enhanced health endpoint (DB+Redis probes), GitHub Actions CI/CD, production Docker Compose (hardened), backend tests (~97), frontend tests (91), lint cleanup → 0 warnings | Production-ready |

---

## Test Coverage

### Backend — ~97 tests / 7 spec files

| Spec file | Tests | Covers |
|-----------|-------|--------|
| `auth.service.spec.ts` | 14 | login, register, refresh, logout, token rotation |
| `alerts.service.spec.ts` | 8 | CRUD, WS broadcast, NotFoundException |
| `notifications.service.spec.ts` | ~9 | create, mark-read, WS broadcast |
| `stations.service.spec.ts` | 16 | CRUD, lastStatusChange, station-status event |
| `sensors.service.spec.ts` | 20 | CRUD, Redis cache hit/miss, injectReading |
| `flows.service.spec.ts` | 18 | CRUD, activate/deactivate, graph validation |
| `iot.service.spec.ts` | 12 | MQTT processing, threshold alerts, error handling |

### Frontend — 91 tests / 5 test files

| Test file | Tests | Covers |
|-----------|-------|--------|
| `AdminNavbar.test.jsx` | 11 | notification bell, badge count, mark-read |
| `notificationsSlice.test.js` | 25 | all reducers + selectors |
| `alertsSlice.test.js` | 22 | all reducers + selectors |
| `SensorDetailsPage.test.jsx` | 22 | loading/error/loaded states, KPIs, live feed |
| `useSocket.test.js` | 19 | guard conditions, event handlers, cleanup |

---

## How to Run

### Development

```bash
# 1 — Clone
git clone <repo-url> pfe-project
cd pfe-project

# 2 — Start all 5 services (PostgreSQL, Redis, Mosquitto, backend, frontend)
docker compose up -d

# 3 — Seed demo data (first time only)
cd backend && npm run seed

# 4 — Open
#   App:    http://localhost:3000
#   API:    http://localhost:3001/api/docs
#   Health: http://localhost:3001/api/health
```

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@aquaflow.io` | `Admin123!` |
| Operator | `operator@aquaflow.io` | `Admin123!` |
| Technician | `tech@aquaflow.io` | `Admin123!` |
| Analyst | `analyst@aquaflow.io` | `Admin123!` |

### Run Tests

```bash
# Backend unit tests (~97)
cd backend && npm test

# Frontend tests (91)
cd frontend && npm test -- --watchAll=false --forceExit

# Verify CI lint build (must output "Compiled successfully.")
cd frontend && CI=true npm run build
```

### Production Deployment

```bash
# 1 — Fill in secrets
cp .env.example .env.prod
# Edit .env.prod — set POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, etc.

# 2 — Generate MQTT password file
docker run --rm eclipse-mosquitto:2 \
  sh -c "mosquitto_passwd -b /dev/stdout $MQTT_USERNAME $MQTT_PASSWORD" \
  > mosquitto/config/passwd

# 3 — Start hardened prod stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4 — Run migrations
docker compose -f docker-compose.prod.yml exec backend npm run migration:run
```

---

## Project Scale

| Metric | Value |
|--------|-------|
| Backend source files | ~60 `.ts` files |
| Frontend source files | ~70 `.js` / `.jsx` files |
| REST API endpoints | ~52 |
| Redux slices | 11 |
| Database entities | 9 |
| Database tables | 9 (1 migration) |
| Workflow block types | 14 |
| Real-time event types | 6 |
| Test files | 12 (7 backend + 5 frontend) |
| Total automated tests | ~188 |
| Docker services | 5 (dev) / 5 (prod, hardened) |
| CI/CD pipelines | 2 (backend + frontend) |
| Swagger endpoints documented | ~52 |

---

## Key Architecture Decisions

### 1. Redis dual-use
The same Redis instance serves two independent purposes: JWT refresh-token denylist (logout invalidation) and sensor-list response cache (TTL-based). An in-memory fallback ensures the application starts even when Redis is unavailable.

### 2. IoT → Alert pipeline (synchronous, no queue)
`IotService` receives MQTT messages, persists `SensorData`, checks thresholds, and creates `Alert` records with a WebSocket broadcast — all inline, no message queue. Sufficient for the expected sensor volume at this scale.

### 3. Workflow graph as JSONB
The full workflow node/edge graph is stored as a JSONB column on the `Workflow` entity. This means the entire definition travels with the record and can be versioned by simply saving a new copy. `NodeExecutor` dispatches to 14 typed handlers injected with real NestJS services.

### 4. Frontend auth interceptor (silent refresh)
Axios interceptor in `apiClient.js` catches 401 responses, silently calls `POST /auth/refresh`, replaces the access token in Redux and localStorage, then retries the original request. Users never see a redirect unless the refresh token is also expired.

### 5. Socket.IO room subscriptions
Clients subscribe to named channels (`dashboard`, `alerts`, `stations`, `sensors`) on connect. Backend broadcasts are scoped to subscribed rooms rather than flooding all connected clients.

### 6. analyticsSlice design (local + Redux split)
UI control state (`selectedSensorId`, date range, preset buttons) stays in local `useState`. Only API-fetched data (overview KPIs, sensor list, time-series stats) lives in Redux — enabling cross-navigation caching without over-engineering ephemeral UI state.

### 7. Hardened production stack
`docker-compose.prod.yml` removes all host-exposed infra ports (PostgreSQL, Redis are internal-only), enforces Redis `--requirepass`, switches Mosquitto to `allow_anonymous false` with a passwd file, adds CPU/memory resource limits per service, and configures log rotation. The backend port is `expose` (internal) not `ports` (host-mapped) — a reverse proxy sits in front.

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `CURRENT_PROJECT_STATE.md` | Full feature audit, infrastructure status, completion by domain |
| `DEV_TEST_GUIDE.md` | Step-by-step setup, test commands, production deployment |
| `NEXT_DEVELOPMENT_STEPS.md` | All completed tasks by phase; future extension ideas |
| `AI_CONTINUATION_PROMPT.md` | Self-contained context block for starting a new AI session |
| `PROGRESS_REPORT.md` | Historical development log with per-phase diffs |
| `TASK_P4_[1-6]_REPORT.md` | Detailed task reports for each P4 DevOps task |
