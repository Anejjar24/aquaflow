# AquaFlow — Complete Project Explanation

> A full-stack industrial water-station supervision platform built as a PFE (end-of-study project).
> This document explains every layer of the system to someone reading the code for the first time.

---

## Table of Contents

1. [What Is AquaFlow?](#1-what-is-aquaflow)
2. [Technology Stack](#2-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Infrastructure Layer (Docker)](#4-infrastructure-layer-docker)
5. [Backend Architecture (NestJS)](#5-backend-architecture-nestjs)
6. [Database Schema (PostgreSQL + TypeORM)](#6-database-schema-postgresql--typeorm)
7. [IoT Data Pipeline (MQTT)](#7-iot-data-pipeline-mqtt)
8. [Real-Time Layer (Socket.IO)](#8-real-time-layer-socketio)
9. [Authentication & Security](#9-authentication--security)
10. [Automation Engine (Workflow Builder)](#10-automation-engine-workflow-builder)
11. [Frontend Architecture (React)](#11-frontend-architecture-react)
12. [Redux State Management](#12-redux-state-management)
13. [Frontend Pages & Features](#13-frontend-pages--features)
14. [Key Data Flows End-to-End](#14-key-data-flows-end-to-end)
15. [API Reference Summary](#15-api-reference-summary)
16. [Project File Map](#16-project-file-map)

---

## 1. What Is AquaFlow?

AquaFlow is a **SCADA-like web platform** for supervising industrial water treatment and distribution stations. It solves the problem of operators who need to:

- Monitor **dozens of sensors** across multiple stations in real time
- Receive **instant alerts** when values exceed safe thresholds
- Track **maintenance work orders** across sites
- Build **automated workflows** that react to sensor events without writing code
- Analyse **historical trends** with aggregated statistics

The system sits between physical IoT devices (sensors/pumps) and the human operators. It receives raw sensor readings via **MQTT**, stores them in **PostgreSQL**, broadcasts live updates via **WebSocket**, and presents everything through a **React dashboard**.

---

## 2. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend runtime** | Node.js 20 + NestJS 10 | Decorator-based DI, TypeScript first, module system |
| **API** | REST + Swagger/OpenAPI | Auto-documented, tested via browser |
| **Real-time** | Socket.IO | Works with proxies, auto-reconnect, rooms |
| **IoT messaging** | MQTT (Eclipse Mosquitto) | Industry standard for sensor telemetry |
| **Database** | PostgreSQL 15 | ACID, JSON columns for flexible config |
| **ORM** | TypeORM | TypeScript decorators, migrations, relations |
| **Cache / denylist** | Redis 7 | JWT refresh-token denylist, sensor list cache |
| **Frontend** | React 18 + Vite | SPA, fast HMR |
| **UI components** | Argon Dashboard + Reactstrap | Bootstrap-based admin template |
| **State** | Redux Toolkit | Predictable state, dev tools |
| **Charts** | Chart.js + react-chartjs-2 | Line, Bar, Doughnut charts |
| **Workflow canvas** | JointJS | Node-and-edge diagram editor |
| **Password hashing** | Argon2 | Industry-best KDF for passwords |
| **Containerisation** | Docker Compose | One-command full-stack startup |

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PHYSICAL LAYER                           │
│  Water sensors (temperature, pressure, pH, flow, level…)   │
│  Pumps, actuators, PLCs                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ MQTT publish  (topic: sensors/{id}/data)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               MOSQUITTO MQTT BROKER  :1883                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ subscribe
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NESTJS BACKEND  :3001                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   Auth   │  │ Stations │  │ Sensors  │  │  Alerts   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Flows   │  │Analytics │  │  Notifs  │  │Maintenance│  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                             │
│  ┌─────────────────────┐   ┌────────────────────────────┐  │
│  │  IoT / MQTT Client  │   │  Socket.IO Gateway  :3001  │  │
│  └─────────────────────┘   └────────────────────────────┘  │
└──────┬────────────┬──────────────────────────┬─────────────┘
       │            │                          │
       ▼            ▼                          ▼ WebSocket
┌────────────┐ ┌──────────┐          ┌────────────────────┐
│ PostgreSQL │ │  Redis   │          │  React Frontend    │
│   :5432    │ │  :6379   │          │  (Nginx)  :3000    │
└────────────┘ └──────────┘          └────────────────────┘
```

**Summary of communication:**
- Sensors → MQTT → Backend IoT service → PostgreSQL + WebSocket
- Browser → REST API → Backend → PostgreSQL
- Backend → WebSocket → Browser (live updates, no polling)
- Backend → Redis (JWT denylist + sensor list cache)

---

## 4. Infrastructure Layer (Docker)

**File:** `docker-compose.yml`

Five containers run together:

```
aquaflow-postgres   PostgreSQL 15        :5432  persistent volume
aquaflow-redis      Redis 7              :6379  persistent volume
aquaflow-mosquitto  Eclipse Mosquitto    :1883 (MQTT), :9001 (WebSocket MQTT)
aquaflow-backend    NestJS app           :3001
aquaflow-frontend   React (via Nginx)    :3000
```

All containers share a Docker bridge network `aquaflow-network`. The backend uses
container DNS names (`postgres`, `redis`, `mosquitto`) — not localhost — because they
run as peers inside the network.

**Health checks** are defined for postgres, redis, and mosquitto. The backend container
`depends_on` all three with `condition: service_healthy`, so NestJS never starts before
the DB is ready.

**Environment variables** that you should override in a `.env` file in production:

```
JWT_SECRET                 # HS256 secret — must be at least 32 characters
JWT_REFRESH_SECRET         # separate secret for refresh tokens
REACT_APP_API_URL          # set to your public backend URL
REACT_APP_WS_URL           # set to your public backend URL (WebSocket)
FRONTEND_URL               # CORS allowed origin for the backend
```

---

## 5. Backend Architecture (NestJS)

**Root:** `backend/src/`

NestJS organises code into **Modules** — each module is a self-contained vertical slice
of the application (its own controller, service, DTOs). The root module (`AppModule`) imports
all feature modules.

```
backend/src/
├── main.ts                  Bootstrap: Swagger, ValidationPipe, CORS, listen :3001
├── app.module.ts            Root module — imports everything below
│
├── auth/                    JWT authentication (register, login, refresh, logout, me)
├── stations/                Station CRUD + status filter + delete
├── sensors/                 Sensor CRUD + history + manual reading injection
├── alerts/                  Alert CRUD + acknowledge + resolve
├── maintenance/             Maintenance work-order CRUD
├── analytics/               Aggregated stats (overview, sensor stats, station history)
├── notifications/           In-app notifications + email (optional SMTP)
├── flows/                   Workflow persistence (CRUD in PostgreSQL)
├── execution/               Workflow execution engine (14 block types)
│   ├── engine/
│   │   ├── workflow-runner.ts      Topological execution loop
│   │   ├── node-executor.ts        Routes each node type to its handler
│   │   └── execution-context.ts   Carries state between nodes
│   └── handlers/                  One file per block type
│
├── realtime/                Socket.IO gateway + RealtimeService
├── iot/                     MQTT client + IotService (sensor data pipeline)
├── database/
│   ├── database.module.ts   TypeORM async config (reads env vars)
│   ├── database.service.ts  healthCheck() utility
│   ├── entities/            9 TypeORM entity classes
│   ├── migrations/          SQL migration files (run via typeorm CLI)
│   └── seeds/               Seed script for test data
└── common/
    ├── guards/              JwtGuard, RolesGuard
    ├── decorators/          @Roles(), @CurrentUser()
    └── types/               workflow.types.ts (shared interfaces)
```

### How a typical request flows through NestJS

```
HTTP POST /api/alerts
    │
    ▼
JwtGuard          → verifies Bearer token (checks Redis denylist)
    │
    ▼
RolesGuard        → checks @Roles() decorator against user.role
    │
    ▼
ValidationPipe    → validates + transforms request body using class-validator DTO
    │
    ▼
AlertsController  → calls AlertsService.create()
    │
    ▼
AlertsService     → save to DB, broadcast WebSocket, fire notification (async)
    │
    ▼
JSON response
```

---

## 6. Database Schema (PostgreSQL + TypeORM)

**Entities:** `backend/src/database/entities/`

There are **9 entities**. Here is the full relationship map:

```
User (users)
 ├── created many Stations
 ├── created many Workflows
 ├── acknowledged/resolved many Alerts
 └── assigned to many Maintenances

Station (stations)
 ├── has many Sensors
 ├── has many Alerts
 └── has many Maintenances

Sensor (sensors)
 ├── belongs to one Station
 ├── has many SensorData (raw time-series readings)
 └── has many Alerts (threshold violations)

SensorData (sensor_data)
 └── belongs to one Sensor
     (indexed on sensor_id + timestamp for fast range queries)

Alert (alerts)
 ├── belongs to one Station (optional)
 ├── belongs to one Sensor (optional)
 ├── acknowledged_by → User
 ├── resolved_by → User
 └── has many Notifications

Maintenance (maintenances)
 ├── belongs to one Station
 ├── created_by → User
 └── assigned_to → User

Workflow (workflows)
 ├── created_by → User
 ├── updated_by → User
 ├── graph: JSONB           (serialized node+edge graph)
 └── has many WorkflowExecutions

WorkflowExecution (workflow_executions)
 ├── belongs to one Workflow
 ├── triggered_by → User
 └── nodeStates: JSONB      (per-node execution results)

Notification (notifications)
 ├── belongs to one User (null = broadcast to all)
 └── belongs to one Alert
```

### Key entity details

**User** — 4 roles with increasing permissions:
- `analyst` — read-only everywhere
- `technician` — read + can create/update maintenance, acknowledge alerts
- `operator` — above + full station/sensor management, alert resolve
- `admin` — everything including delete

**Sensor** — stores the *latest* reading as denormalised columns (`lastReading`, `lastReadingAt`)
for O(1) dashboard lookups. Full history is in `SensorData`. Has a computed getter
`isThresholdViolated` that the IoT pipeline uses to auto-create alerts.

**Workflow** — the `graph` column is JSONB storing the full visual editor state
(nodes array + edges array). The execution engine reads this at runtime.

**SensorData** — the high-volume table. Has a composite index on `(sensor_id, timestamp)`
so time-range queries stay fast even with millions of rows.

---

## 7. IoT Data Pipeline (MQTT)

**Files:** `backend/src/iot/`

This is the automated ingestion path — no human involved.

### Step-by-step flow

```
Physical sensor publishes:
  topic:   sensors/abc-123/data
  payload: 45.7

        │
        ▼
MqttClient  (backend/src/iot/mqtt/mqtt.client.ts)
  Subscribed topics:
    sensors/+/data      ← sensor readings
    sensors/+/status    ← sensor status changes
  Parses sensorId from topic[1], value = parseFloat(payload)
        │
        ▼
IotService.processSensorData(sensorId, value)
  1. Find sensor in DB
  2. Update sensor.lastReading = value
  3. Update sensor.lastReadingAt = now()
  4. Set sensor.status = ACTIVE
  5. Check sensor.isThresholdViolated
  6. Save sensor to DB
  7. Save new SensorData record to DB
  8. Broadcast WebSocket event  →  "sensor-update" to all connected browsers
  9. If threshold violated AND sensor.alertEnabled:
       AlertsService.create(THRESHOLD_VIOLATION alert)
       → Saves alert to DB
       → Broadcasts "alert-created" WebSocket event
       → NotificationsService.notifyAlertCreated() (fire-and-forget)
           → Saves in-app notification to DB
           → Broadcasts "notification-created" WebSocket event
           → Sends email if SMTP_HOST configured
```

### Manual reading injection (for testing)

When no physical device is available, use:
```
POST /api/sensors/{id}/reading   body: { "value": 42.5 }
```
This runs exactly the same `injectReading()` path — updates `lastReading`,
persists a `SensorData` record — so the Automation Builder can read real values.

---

## 8. Real-Time Layer (Socket.IO)

**Backend:** `backend/src/realtime/`  
**Frontend:** `frontend/src/hooks/useSocket.js`

### How the WebSocket connection works

```
Browser (useSocket.js)
  ↓ connects with JWT token in auth handshake
Socket.IO Gateway (NestJS)
  ↓ verifies JWT on connect → maps clientId → userId
RealtimeService
  ↓ stores Map<clientId, Socket>
```

### Events emitted by the backend

| Event | Triggered by | Payload |
|---|---|---|
| `sensor-update` | IotService after MQTT reading | `{ sensorId, value, timestamp, thresholdViolated }` |
| `alert-created` | AlertsService.create() | `{ id, severity, message, station }` |
| `station-status` | StationsService.update() when status changes | `{ stationId, status, name, timestamp }` |
| `notification-created` | NotificationsService.notifyAlertCreated() | `{ alertId, title, severity, … }` |
| `notifications-read-all` | NotificationsService.markAllRead() | `{ count: 0 }` |

### What the frontend does with each event

```javascript
// useSocket.js — one central hook used by every page
socket.on('sensor-update', (data) => {
  dispatch(sensorRealtimeUpdated(data));   // update sensor lastReading in sensors slice
  dispatch(applySensorUpdate(data));        // update dashboard stats
});

socket.on('alert-created', (data) => {
  dispatch(alertRealtimeReceived(data));   // prepend to alerts table
  dispatch(addDashboardAlert(data));        // prepend to dashboard feed
});

socket.on('station-status', (data) => {
  dispatch(stationRealtimeUpdated(data));  // update station badge colour
  dispatch(updateStationStatus(data));      // update dashboard station card
});

socket.on('notification-created', (data) => {
  dispatch(notificationReceived(data));    // bell badge count +1
});
```

Every page calls `useSocket(true)` which creates a single socket connection per
browser tab with automatic reconnection (10 attempts, 1.5 s delay).

---

## 9. Authentication & Security

**Files:** `backend/src/auth/`

### Token strategy

AquaFlow uses a **dual-token JWT** pattern:

```
POST /api/auth/login
  → access_token   (expires in 15 min, short-lived)
  → refresh_token  (expires in 7 days, long-lived)

POST /api/auth/refresh  (with refresh_token)
  → new access_token
  → new refresh_token  (rotation — old one is denylisted in Redis)

POST /api/auth/logout
  → refresh_token added to Redis denylist (TTL = 7 days)
```

### Why Redis for the denylist?

JWTs are stateless by design — you can't "revoke" them without a server-side store.
When a user logs out, we store a hash of the refresh token in Redis with a TTL equal
to the token's remaining lifetime. `refreshToken()` checks Redis first — if the token
is there, it throws 401 immediately.

### Password security

Passwords are hashed with **Argon2id** (memory-hard KDF) via the `PasswordUtil` class.
Argon2id is the winner of the Password Hashing Competition and is resistant to GPU
and ASIC attacks.

### Request guards

Every protected route uses:
```typescript
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
```

`JwtGuard` — extracts `Bearer` token, verifies signature, checks Redis denylist.  
`RolesGuard` — reads `@Roles()` decorator, compares against `request.user.role`.  
If no `@Roles()` decorator → any authenticated user can access.

### Frontend token management

`frontend/src/services/apiClient.js` — Axios instance with two interceptors:
1. **Request interceptor** — reads token from `localStorage` via `authSession.js`, adds `Authorization: Bearer …` header automatically.
2. **Response interceptor** — if any request returns 401, silently calls `POST /auth/refresh`, updates `localStorage`, retries the original request once. If refresh also fails, clears session and redirects to login.

---

## 10. Automation Engine (Workflow Builder)

**Frontend:** `frontend/src/views/builder/` + `frontend/src/data/blocks.js`  
**Backend:** `backend/src/flows/` + `backend/src/execution/`

This is the most complex feature. It lets operators draw automation logic visually
and execute it without writing code.

### How the builder works (frontend)

The visual canvas is powered by **JointJS** — a graph library that renders
nodes and edges as SVG. The builder has three panels:

```
┌──────────────┬──────────────────────────────────┬──────────────────┐
│  Block       │                                  │   Properties     │
│  Sidebar     │    JointJS Canvas                │   Panel          │
│              │    (drag & drop nodes here)       │   (selected      │
│  14 block    │    (draw edges between ports)     │    node config)  │
│  types       │                                  │                  │
└──────────────┴──────────────────────────────────┴──────────────────┘
```

**Ports** are the connection points on each block. Each block type defines which
ports it has in `frontend/src/data/blocks.js`. For example:

```javascript
threshold-check block:
  inputs:  [{ id: "value", label: "Value" }]
  outputs: [{ id: "breach", label: "Breach" },
            { id: "pass",   label: "Pass" }]
```

An edge from `sensor-read.value` → `threshold-check.value` carries the sensor reading.  
An edge from `threshold-check.breach` → `alert-trigger.trigger` fires the alert only when breached.

### Block types (14 total)

**Generic blocks** — no external dependencies:
| Block | What it does |
|---|---|
| `input` | Injects a static value into the workflow |
| `output` | Formats the final result (json/text/number) |
| `action` | Math/string transform (multiply, add, uppercase, append…) |
| `decision` | Numeric comparison → routes `true` / `false` branches |
| `delay` | Sleeps N milliseconds (max 30 s), passes input through |
| `api` | Mocked — logs intent, returns input (placeholder) |
| `notification` | Mocked — logs channel + message (placeholder) |

**Industrial blocks** — talk to real infrastructure:
| Block | What it does | Side effect |
|---|---|---|
| `sensor-read` | Reads `sensor.lastReading` from DB | None |
| `threshold-check` | Compares value to min/max thresholds | None (routing only) |
| `alert-trigger` | Creates a real Alert in DB | Alert appears in Alerts page |
| `pump-control` | Publishes MQTT command to a device | MQTT message sent |
| `mqtt-publish` | Publishes to any MQTT topic | MQTT message sent |
| `station-control` | Updates station status in DB + WebSocket | Station badge updates live |
| `http-request` | Calls any external HTTP URL | Network request from backend |

### How execution works (backend)

```
POST /api/flows/execute   body: { graph: { nodes, edges }, input: {} }
        │
        ▼
FlowValidatorService.validate()
  → checks all node types are known (14 valid types)
  → checks all edge endpoints reference real node IDs
  → checks no self-loops
        │
        ▼
WorkflowRunner.run()
  1. Build adjacency maps (outgoing edges, incoming edges)
  2. Find start nodes: type==='input' OR has no incoming edges
  3. BFS queue loop:
     a. Dequeue next node
     b. Get input = output of previous node (from context)
        OR workflow's initial input (if no incoming edges)
     c. NodeExecutor.execute(node, input, context)
        → switches on node.type → calls correct handler
     d. Store output in ExecutionContext
     e. filterDecisionEdges() — if output has .branch field,
        only follow edges whose sourcePort matches branch
     f. Push reachable target nodes onto queue
  4. Return { workflowId, status, output, steps[] }
```

### Port-based routing example

```
threshold-check output: { value: 95, breach: true, branch: "breach" }

Outgoing edges from threshold-check:
  edge A: sourcePort="breach" → alert-trigger  ← TAKEN  (branch matches)
  edge B: sourcePort="pass"   → output          ← SKIPPED (branch mismatch)
```

### Workflow persistence

Saved workflows are stored in the `workflows` table (JSONB `graph` column).
`GET /api/flows` → list all. `PUT /api/flows/:id` → update graph.
The Builder auto-saves every 30 s via `useAutosave.js`.

---

## 11. Frontend Architecture (React)

**Root:** `frontend/src/`

```
frontend/src/
├── main.jsx              Entry point — ReactDOM.render, Redux Provider, Router
├── App.jsx               Route layout switcher (admin vs auth routes)
├── routes.js             Sidebar navigation routes array
│
├── layouts/
│   ├── Admin.js          Wrapper for authenticated pages (Navbar, Sidebar, main content)
│   └── Auth.js           Wrapper for login/register pages
│
├── modules/              Feature pages (one folder per domain)
│   ├── auth/             Login.jsx, Register.jsx
│   ├── dashboard/        DashboardPage.jsx
│   ├── stations/         StationsPage.jsx, StationDetailsPage.jsx
│   ├── monitoring/       MonitoringPage.jsx, SensorDetailsPage.jsx
│   ├── alerts/           AlertsPage.jsx
│   ├── maintenance/      MaintenancePage.jsx
│   └── analytics/        AnalyticsPage.jsx
│
├── store/                Redux Toolkit store
│   ├── store.js          Root store (9 reducers combined)
│   └── slices/           One slice per domain (9 files)
│
├── services/             API call functions (one file per domain)
│   ├── apiClient.js      Axios instance with JWT + auto-refresh interceptors
│   ├── authService.js
│   ├── sensorService.js
│   ├── alertService.js
│   ├── stationService.js
│   ├── maintenanceService.js
│   ├── analyticsService.js
│   ├── notificationService.js
│   └── workflowApi.js
│
├── hooks/
│   ├── useSocket.js       Single Socket.IO connection, dispatches to Redux on events
│   ├── useLogout.js       Clears session + Redux state
│   ├── useAutosave.js     Debounced auto-save for the Workflow Builder
│   ├── useJointGraph.js   JointJS canvas initialisation + event wiring
│   └── useWorkflowEditor.js  Higher-level builder state management
│
├── components/
│   ├── Navbars/AdminNavbar.js   Top bar with notification bell + dropdown
│   ├── Sidebar/Sidebar.js       Left navigation using routes.js
│   └── builder/                 Builder-specific UI components
│
├── data/
│   └── blocks.js          Definitions for all 14 workflow block types
│
└── views/
    └── builder/BuilderPage.jsx  Workflow Builder canvas page
```

### How a page is structured (pattern used everywhere)

```javascript
export default function MonitoringPage() {
  const dispatch = useDispatch();
  const sensors = useSelector(selectSensors);      // read from Redux store
  const isLoading = useSelector(selectSensorsLoading);

  useSocket(true);                                  // connect WebSocket

  useEffect(() => {
    dispatch(fetchSensors());                       // load data on mount
  }, [dispatch]);

  const handleDelete = (id) => {
    dispatch(deleteSensor(id));                     // optimistic Redux update
  };

  return ( /* JSX table + modals */ );
}
```

Every page follows the same pattern:
1. `useSelector` to read state from Redux
2. `useSocket(true)` to open WebSocket (idempotent — one socket per tab)
3. `useEffect` + `dispatch(fetchXxx())` to load initial data
4. Event handlers call `dispatch(actionThunk())` — never call API directly
5. Redux thunks call service functions → `apiClient` → REST API

---

## 12. Redux State Management

**Files:** `frontend/src/store/slices/`

### The 9 slices and what they own

| Slice | State shape | Key thunks |
|---|---|---|
| `authSlice` | `{ user, accessToken, refreshToken, isLoading }` | `login`, `register`, `logout`, `refreshToken` |
| `stationsSlice` | `{ items[], meta, filters, isLoading, isSaving }` | `fetchStations`, `createStation`, `updateStation`, `deleteStation` |
| `sensorsSlice` | `{ items[], meta, isLoading, isSaving }` | `fetchSensors`, `createSensor`, `updateSensor`, `deleteSensor` |
| `alertsSlice` | `{ items[], meta, isLoading }` | `fetchAlerts`, `acknowledgeAlert`, `resolveAlert` |
| `maintenanceSlice` | `{ items[], meta, isLoading, isSaving }` | `fetchMaintenance`, `createMaintenance`, `updateMaintenance`, `deleteMaintenance` |
| `notificationsSlice` | `{ items[], unreadCount, meta, isLoading }` | `fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead` |
| `dashboardSlice` | `{ kpis, recentAlerts[], stationSummary[], sensorUpdates[] }` | `fetchDashboardData` |
| `realtimeSlice` | `{ connected, lastSensorUpdate, lastAlert, lastStationStatus }` | — (reducers only, fed by useSocket) |
| `uiSlice` | `{ sidebarMini, theme, notifications[] }` | — (reducers: `toggleSidebarMini`, `pushNotification`, `dismissNotification`) |

### Thunk pattern (how async calls work)

```javascript
// sensorsSlice.js
export const deleteSensor = createAsyncThunk(
  'sensors/deleteSensor',
  async (id, { rejectWithValue }) => {
    try {
      await sensorService.deleteSensor(id);  // calls DELETE /api/sensors/:id
      return id;                              // returned id is the action.payload
    } catch (error) {
      return rejectWithValue(error.response?.data?.message);
    }
  }
);

// extraReducers listens to the three lifecycle actions:
.addCase(deleteSensor.fulfilled, (state, action) => {
  state.items = state.items.filter(s => s.id !== action.payload);
  state.meta.total -= 1;
})
```

---

## 13. Frontend Pages & Features

### Dashboard (`/admin/dashboard`)
- 4 KPI cards: total stations, active sensors, open alerts, pending maintenance
- Live sensor updates feed (WebSocket)
- Recent alerts table
- Station status summary

### Stations (`/admin/stations`)
- Paginated table with status/type/search filters (all wired to API)
- Create/Edit modal with validation
- Delete (admin only) with confirmation
- Status badges update live via WebSocket when any station changes status
- Click **View** → navigates to Station Details page

### Station Details (`/admin/stations/:stationId`)
- 4 KPI cards: status, sensor count, active alerts, capacity
- Metadata panel (location, coordinates, description)
- Sensors table showing `lastReading` and `lastReadingAt`
- Recent alerts table for that station

### Monitoring (`/admin/monitoring`)
- Sensor table with live last-reading values (WebSocket updated)
- Edit sensor (admin/operator) — full form modal
- Delete sensor (admin only) — confirmation modal
- **View** button → navigates to Sensor Details page

### Sensor Details (`/admin/monitoring/:sensorId`)
- Line chart (Chart.js) of historical readings
- Min/max threshold reference lines on the chart
- Limit buttons: 50 / 100 / 200 / 500 readings
- KPI cards: status, last reading, thresholds

### Alerts (`/admin/alerts`)
- Filterable by severity and status
- **Acknowledge** button (disables if already ack'd)
- **Resolve** button (disables if resolved)
- New alerts prepend automatically via WebSocket
- RBAC: `analyst` sees read-only

### Maintenance (`/admin/maintenance`)
- Full CRUD: create, edit, delete work orders
- Priority badges (low/medium/high/critical)
- Status badges (scheduled/in_progress/completed/cancelled)
- Station assignment
- `canDelete` restricted to admin only

### Analytics (`/admin/analytics`)
- 4 KPI cards from `GET /api/analytics/overview`
- Doughnut chart: stations by status
- Doughnut chart: active alerts by severity
- Sensor dropdown + time range (24h / 7d / 30d / custom)
- Line chart: avg/min/max time-series for selected sensor + range

### Automation Builder (`/admin/builder`)
- Visual drag-and-drop canvas (JointJS)
- 14 block types in the left sidebar
- Click a block → configure it in the right Properties panel
- Connect blocks by dragging from output port to input port
- **Save** → `POST /api/flows` (persists to PostgreSQL)
- **Run** → `POST /api/flows/execute` (executes in-memory, returns step-by-step trace)
- Auto-saves every 30 seconds

### Notification Bell (AdminNavbar)
- Live unread count badge (from `notificationsSlice`)
- Dropdown panel: last 8 notifications
- Per-item **Mark read** button
- **Mark all read** link
- WebSocket-driven: count updates instantly when alerts fire

---

## 14. Key Data Flows End-to-End

### A: Sensor reading arrives from physical device

```
1. Sensor publishes MQTT:  sensors/abc/data  →  "62.3"
2. MqttClient receives it, calls IotService.processSensorData("abc", 62.3)
3. IotService:
   a. Updates sensors table: lastReading=62.3, lastReadingAt=now
   b. Inserts sensor_data row: value=62.3, timestamp=now
   c. Emits WebSocket "sensor-update" to all browsers
   d. Checks threshold: 62.3 > sensor.maxThreshold=50 → VIOLATED
   e. AlertsService.create(threshold_violation alert)
      → inserts alerts row
      → emits WebSocket "alert-created" to all browsers
      → NotificationsService.notifyAlertCreated() [fire-and-forget]
         → inserts notifications row
         → emits WebSocket "notification-created"

4. Browser (useSocket.js):
   "sensor-update" → sensorsSlice updates lastReading on that row (live table)
   "alert-created" → alertsSlice prepends to alerts table + dashboard feed
   "notification-created" → notificationsSlice increments unread count → bell badge +1
```

### B: Operator acknowledges an alert

```
1. Operator clicks "Acknowledge" on AlertsPage
2. dispatch(acknowledgeAlert(alertId))
3. alertService.acknowledgeAlert(id) → PATCH /api/alerts/:id/acknowledge
4. AlertsController → AlertsService.acknowledge()
   → updates alert: status=ACKNOWLEDGED, acknowledgedAt=now, acknowledgedBy=user
   → returns updated alert
5. alertsSlice.fulfilled: replaces alert in items[] → button becomes disabled
```

### C: Workflow executes a sensor→threshold→alert flow

```
1. User clicks "Run" in the Builder
2. POST /api/flows/execute  { graph: {nodes, edges}, input: {} }
3. FlowValidatorService checks all node types are valid
4. WorkflowRunner starts BFS from sensor-read node (no incoming edges)
5. sensor-read: SELECT lastReading FROM sensors WHERE id=?
   → output: { value: "62.3", sensorId, name, unit, … }
6. threshold-check: extracts input.value = 62.3, compares to maxThreshold=50
   → breach=true, branch="breach"
   → edge with sourcePort="breach" followed → alert-trigger queued
7. alert-trigger: AlertsService.create(…)
   → real alert saved to DB, WebSocket fires, bell increments
   → output: { alertId, severity, status }
8. Response: { status:"success", steps:[{nodeId, type, input, output}, …] }
```

### D: User logs out

```
1. dispatch(logout()) → POST /api/auth/logout { refresh_token }
2. AuthService.logout():
   → stores SHA-256 hash of refresh_token in Redis with 7-day TTL
3. authSlice clears user + tokens from Redux
4. authSession.js clears localStorage
5. Axios interceptor loses token → all future requests get 401
6. Socket disconnects (token gone, useSocket skips connection)
7. React Router redirects to /auth/login
```

---

## 15. API Reference Summary

All endpoints are documented at `http://localhost:3001/api/docs` (Swagger UI).
All routes require `Authorization: Bearer <access_token>` unless marked public.

### Auth (public)
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get access + refresh tokens |
| POST | `/api/auth/refresh` | Rotate tokens |
| POST | `/api/auth/logout` | Denylist refresh token |
| GET | `/api/auth/me` | Current user profile |

### Stations
| Method | Path | Description |
|---|---|---|
| GET | `/api/stations` | List (paginated, filter by status/type/search) |
| POST | `/api/stations` | Create (admin/operator) |
| GET | `/api/stations/:id` | Get with sensors + alerts + maintenances |
| PATCH | `/api/stations/:id` | Update (admin/operator) |
| DELETE | `/api/stations/:id` | Delete (admin) |

### Sensors
| Method | Path | Description |
|---|---|---|
| GET | `/api/sensors` | List (paginated, filter by type/status/station) |
| POST | `/api/sensors` | Create (admin/operator) |
| GET | `/api/sensors/:id` | Get with station + recent alerts |
| PATCH | `/api/sensors/:id` | Update (admin/operator) |
| DELETE | `/api/sensors/:id` | Delete (admin) |
| GET | `/api/sensors/:id/data` | Historical readings (newest first) |
| POST | `/api/sensors/:id/reading` | **Inject manual reading** (for testing) |

### Alerts
| Method | Path | Description |
|---|---|---|
| GET | `/api/alerts` | List (filter by severity/status/station) |
| POST | `/api/alerts` | Create |
| GET | `/api/alerts/:id` | Get single |
| PATCH | `/api/alerts/:id/acknowledge` | Mark acknowledged |
| PATCH | `/api/alerts/:id/resolve` | Mark resolved |

### Maintenance
| Method | Path | Description |
|---|---|---|
| GET | `/api/maintenance` | List all work orders |
| POST | `/api/maintenance` | Create work order |
| GET | `/api/maintenance/:id` | Get single |
| PATCH | `/api/maintenance/:id` | Update |
| DELETE | `/api/maintenance/:id` | Delete (admin) |

### Flows (Automation)
| Method | Path | Description |
|---|---|---|
| GET | `/api/flows` | List saved workflows |
| POST | `/api/flows` | Save new workflow |
| GET | `/api/flows/:id` | Get single workflow |
| PUT | `/api/flows/:id` | Replace workflow graph |
| DELETE | `/api/flows/:id` | Delete workflow |
| POST | `/api/flows/execute` | Execute a graph in-memory |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics/overview` | System-wide KPIs |
| GET | `/api/analytics/sensors/:id/stats` | Avg/min/max/stddev + hourly buckets |
| GET | `/api/analytics/stations/:id/history` | Per-sensor readings grouped by hour/day |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | List notifications (paginated) |
| GET | `/api/notifications/unread-count` | `{ count: N }` |
| PATCH | `/api/notifications/:id/read` | Mark one as read |
| PATCH | `/api/notifications/read-all` | Mark all read + WebSocket event |

---

## 16. Project File Map

> Where to find anything in the codebase.

```
pfe-project/
│
├── docker-compose.yml                   ← Start the entire stack here
├── mosquitto/config/mosquitto.conf      ← MQTT broker config
│
├── backend/
│   ├── .env  (create this)              ← DB/JWT/MQTT/Redis env vars
│   ├── src/
│   │   ├── main.ts                      ← Swagger setup, global pipes, port
│   │   ├── app.module.ts                ← All module imports + Redis config
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.controller.ts       ← /api/auth/* routes
│   │   │   ├── auth.service.ts          ← JWT issue/verify, Argon2 hash, Redis denylist
│   │   │   └── strategies/jwt.strategy.ts ← Passport JWT strategy
│   │   │
│   │   ├── stations/
│   │   │   ├── stations.controller.ts   ← CRUD routes
│   │   │   └── stations.service.ts      ← broadcasts station-status WebSocket on update
│   │   │
│   │   ├── sensors/
│   │   │   ├── sensors.controller.ts    ← CRUD + /data history + /reading injection
│   │   │   └── sensors.service.ts       ← Redis cache for sensor list (60 s TTL)
│   │   │
│   │   ├── alerts/
│   │   │   ├── alerts.controller.ts     ← CRUD + /acknowledge + /resolve
│   │   │   └── alerts.service.ts        ← broadcasts alert-created, fires notification
│   │   │
│   │   ├── analytics/
│   │   │   ├── analytics.controller.ts  ← /overview, /sensors/:id/stats, /stations/:id/history
│   │   │   └── analytics.service.ts     ← PostgreSQL DATE_TRUNC queries, stddev
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.controller.ts ← /notifications CRUD + mark-read
│   │   │   └── notifications.service.ts    ← email via nodemailer, WebSocket broadcast
│   │   │
│   │   ├── flows/
│   │   │   ├── flows.controller.ts      ← CRUD + /execute
│   │   │   ├── flows.service.ts         ← TypeORM Repository<Workflow>
│   │   │   ├── flow-validator.service.ts ← validates node types + edge references
│   │   │   └── flow-executor.service.ts ← delegates to WorkflowRunner
│   │   │
│   │   ├── execution/
│   │   │   ├── engine/
│   │   │   │   ├── workflow-runner.ts   ← BFS execution loop + port routing
│   │   │   │   ├── node-executor.ts     ← switch(node.type) → handler
│   │   │   │   └── execution-context.ts ← stores node outputs between steps
│   │   │   └── handlers/               ← 11 handler files, one per block type
│   │   │       ├── sensor-read.handler.ts
│   │   │       ├── threshold-check.handler.ts
│   │   │       ├── alert-trigger.handler.ts
│   │   │       ├── pump-control.handler.ts
│   │   │       ├── mqtt-publish.handler.ts
│   │   │       ├── station-control.handler.ts
│   │   │       ├── http-request.handler.ts
│   │   │       ├── action.handler.ts
│   │   │       ├── decision.handler.ts
│   │   │       ├── input.handler.ts
│   │   │       └── output.handler.ts
│   │   │
│   │   ├── iot/
│   │   │   ├── mqtt/mqtt.client.ts      ← subscribes to sensors/+/data, parses payload
│   │   │   └── iot.service.ts           ← processSensorData(): DB + WebSocket + alerts
│   │   │
│   │   ├── realtime/
│   │   │   ├── realtime.gateway.ts      ← Socket.IO server, JWT on connect
│   │   │   └── realtime.service.ts      ← broadcastToAll(), Map<clientId, Socket>
│   │   │
│   │   ├── database/
│   │   │   ├── entities/               ← 9 TypeORM entity classes
│   │   │   └── migrations/             ← SQL migration files
│   │   │
│   │   └── common/
│   │       ├── guards/jwt.guard.ts      ← Passport JWT guard
│   │       ├── guards/roles.guard.ts    ← RBAC guard
│   │       └── decorators/             ← @Roles(), @CurrentUser()
│   │
│   └── test/auth.e2e-spec.ts           ← E2E smoke tests (NestJS test app)
│
└── frontend/
    ├── src/
    │   ├── main.jsx                     ← Entry point
    │   ├── App.jsx                      ← Router: /admin/* vs /auth/*
    │   ├── routes.js                    ← Sidebar nav + page components
    │   │
    │   ├── layouts/Admin.js             ← Navbar + Sidebar shell + dynamic routes
    │   │
    │   ├── modules/                     ← One subfolder per domain
    │   │   ├── auth/pages/Login.jsx
    │   │   ├── auth/pages/Register.jsx
    │   │   ├── dashboard/pages/DashboardPage.jsx
    │   │   ├── stations/pages/StationsPage.jsx
    │   │   ├── stations/pages/StationDetailsPage.jsx
    │   │   ├── monitoring/pages/MonitoringPage.jsx
    │   │   ├── monitoring/pages/SensorDetailsPage.jsx
    │   │   ├── alerts/pages/AlertsPage.jsx
    │   │   ├── maintenance/pages/MaintenancePage.jsx
    │   │   └── analytics/pages/AnalyticsPage.jsx
    │   │
    │   ├── store/
    │   │   ├── store.js                 ← configureStore with 9 reducers
    │   │   └── slices/                  ← 9 Redux slices
    │   │
    │   ├── services/
    │   │   ├── apiClient.js             ← Axios + JWT interceptor + auto-refresh
    │   │   └── *.js                     ← Domain service files (thin wrappers)
    │   │
    │   ├── hooks/
    │   │   ├── useSocket.js             ← Socket.IO + all event handlers
    │   │   ├── useAutosave.js           ← Debounced builder auto-save
    │   │   └── useWorkflowEditor.js     ← Builder state + save/run actions
    │   │
    │   ├── data/blocks.js               ← 14 block type definitions (ports, properties)
    │   └── views/builder/BuilderPage.jsx ← JointJS canvas + panels
    │
    └── Dockerfile                       ← Multi-stage: build React → serve with Nginx
```

---

## Quick Start

```bash
# Clone and enter the project
cd pfe-project

# Create a .env file (minimum required)
echo "JWT_SECRET=my-super-secret-key-32-chars-min" > backend/.env

# Start everything
docker compose up --build

# The app is now available at:
#   Frontend:  http://localhost:3000
#   API:       http://localhost:3001/api
#   Swagger:   http://localhost:3001/api/docs
#   MQTT:      mqtt://localhost:1883

# Default seed credentials (if seed script was run):
#   admin@aquaflow.local     / Admin123!
#   operator@aquaflow.local  / Operator123!
```

For development without Docker:
```bash
# Terminal 1 — backend
cd backend
npm install
npm run start:dev    # hot-reload on :3001

# Terminal 2 — frontend
cd frontend
npm install
npm start            # CRA dev server on :3000

# You still need postgres, redis, mosquitto running
# (can run them alone with: docker compose up postgres redis mosquitto)
```
