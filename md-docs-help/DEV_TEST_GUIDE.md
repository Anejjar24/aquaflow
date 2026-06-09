# AquaFlow — Developer & Test Guide

**Version:** post-P4 (2026-05-27) — all development phases complete  
**Platform:** NestJS 10 backend · React 18 CRA frontend · PostgreSQL 15 · Redis 7 · Mosquitto 2

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-time setup](#2-first-time-setup)
3. [Starting the dev environment](#3-starting-the-dev-environment)
4. [Stopping and resetting](#4-stopping-and-resetting)
5. [Running backend tests](#5-running-backend-tests)
6. [Running frontend tests](#6-running-frontend-tests)
7. [Verifying the frontend CI build](#7-verifying-the-frontend-ci-build)
8. [API verification checklist](#8-api-verification-checklist)
9. [Real-time smoke test](#9-real-time-smoke-test)
10. [Production deployment](#10-production-deployment)
11. [Common problems and fixes](#11-common-problems-and-fixes)

---

## 1. Prerequisites

| Tool | Required version | Install |
|------|-----------------|---------|
| Docker Desktop | 4.x or later | https://www.docker.com/products/docker-desktop |
| Docker Compose | v2 (bundled with Docker Desktop) | — |
| Node.js | 20.x LTS | https://nodejs.org or `nvm install 20` |
| npm | 9+ (bundled with Node 20) | — |
| Git | Any | — |

Verify versions:

```bash
docker --version          # Docker version 24+
docker compose version    # Docker Compose version v2+
node --version            # v20.x.x
npm --version             # 9+
```

---

## 2. First-time Setup

### 2a. Clone and install

```bash
git clone <repo-url> pfe-project
cd pfe-project
```

Install backend dependencies:

```bash
cd backend
npm install
cd ..
```

Install frontend dependencies:

```bash
cd frontend
npm install --legacy-peer-deps
cd ..
```

> `--legacy-peer-deps` is required because `react-chartjs-2@2.x` has a peer dep on Chart.js 2 which conflicts with npm 7+ strict resolution.

### 2b. Environment variables (dev)

The `docker-compose.yml` file already includes all required env vars for the development stack — no `.env` file is needed for local dev. If you want to override any value, copy:

```bash
cp .env.example .env
# Edit .env with your values
```

---

## 3. Starting the Dev Environment

### Full stack (recommended)

```bash
docker compose up -d
```

This starts 5 services:
- `postgres` — PostgreSQL 15 on port **5432**
- `redis` — Redis 7 on port **6379**
- `mosquitto` — MQTT broker on ports **1883** (MQTT) and **9001** (WebSocket)
- `backend` — NestJS on port **3001** (hot-reload via `nest start --watch`)
- `frontend` — React CRA dev server on port **3000** (hot-reload)

**Wait ~15 seconds** for the backend to run migrations on first boot.

### Check health

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"...","uptime":...,"db":{"status":"ok"},"redis":{"status":"ok"}}
```

HTTP 200 = all systems healthy. HTTP 503 = DB or Redis not ready (wait and retry).

### Open the app

- **Frontend:** http://localhost:3000
- **Swagger API docs:** http://localhost:3001/api/docs

### Default demo credentials (seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@aquaflow.io` | `Admin123!` |
| Operator | `operator@aquaflow.io` | `Admin123!` |
| Technician | `tech@aquaflow.io` | `Admin123!` |
| Analyst | `analyst@aquaflow.io` | `Admin123!` |

### Seed the database (first time)

If the database is empty and you want demo stations/sensors/alerts:

```bash
cd backend
npm run seed
```

This creates: 5 stations, 15 sensors (3 per station), 5 alerts, 4 users.

### Start only backend/frontend (without Docker Compose)

If you prefer to run services natively (with Postgres and Redis already running elsewhere):

**Backend:**
```bash
cd backend
# Set env vars:
export DATABASE_HOST=localhost DATABASE_PORT=5432 DATABASE_USER=postgres DATABASE_PASSWORD=postgres DATABASE_NAME=aquaflow
export REDIS_HOST=localhost REDIS_PORT=6379
export JWT_SECRET=dev-secret-32-chars-minimum-here JWT_REFRESH_SECRET=dev-refresh-secret-32-chars-here
export MQTT_BROKER_URL=mqtt://localhost:1883
npm run start:dev
```

**Frontend:**
```bash
cd frontend
export REACT_APP_API_URL=http://localhost:3001/api
export REACT_APP_WS_URL=http://localhost:3001
npm start
```

---

## 4. Stopping and Resetting

Stop containers (preserve volumes):
```bash
docker compose down
```

Stop and destroy all data (wipe DB + Redis):
```bash
docker compose down -v
```

Rebuild images after code changes:
```bash
docker compose up -d --build
```

View logs:
```bash
docker compose logs -f backend     # backend only
docker compose logs -f             # all services
```

---

## 5. Running Backend Tests

### Prerequisites for unit tests

Unit tests use in-memory mocks only — **no database or Redis needed**.

```bash
cd backend
```

### Run all unit tests

```bash
npm test
# or equivalently:
npx jest --config jest.config.js --forceExit
```

Expected output:
```
Test Suites: 7 passed, 7 total
Tests:       ~97 passed, ~97 total
```

### Run a single spec file

```bash
npx jest src/auth/auth.service.spec.ts --forceExit
npx jest src/stations/stations.service.spec.ts --forceExit
npx jest src/sensors/sensors.service.spec.ts --forceExit
npx jest src/flows/flows.service.spec.ts --forceExit
npx jest src/iot/iot.service.spec.ts --forceExit
npx jest src/alerts/alerts.service.spec.ts --forceExit
npx jest src/notifications/notifications.service.spec.ts --forceExit
```

### Run with coverage

```bash
npm run test:cov
# Coverage report output to: backend/coverage/lcov-report/index.html
```

### Run e2e tests

E2e tests require a running PostgreSQL and Redis instance. Use the Docker services:

```bash
docker compose up -d postgres redis
# Wait a few seconds for them to be ready, then:
npm run test:e2e
```

### Watch mode (during active development)

```bash
npm run test:watch
```

---

## 6. Running Frontend Tests

```bash
cd frontend
```

### Run all tests (single pass)

```bash
npm test -- --watchAll=false --passWithNoTests --forceExit
# or with CI mode (same flags CI uses):
CI=true npm test -- --watchAll=false --passWithNoTests --forceExit
```

Expected output:
```
Test Suites: 5 passed, 5 total
Tests:       101 passed, 101 total
```

### Run a single test file

```bash
npx react-scripts test src/store/slices/__tests__/alertsSlice.test.js --watchAll=false --forceExit
npx react-scripts test src/hooks/__tests__/useSocket.test.js --watchAll=false --forceExit
npx react-scripts test src/modules/monitoring/pages/__tests__/SensorDetailsPage.test.jsx --watchAll=false --forceExit
npx react-scripts test src/components/Navbars/__tests__/AdminNavbar.test.jsx --watchAll=false --forceExit
npx react-scripts test src/store/slices/__tests__/notificationsSlice.test.js --watchAll=false --forceExit
```

### Watch mode (during active development)

```bash
npm test
# Opens Jest watch mode — press 'a' to run all, 'p' to filter by file pattern
```

---

## 7. Verifying the Frontend CI Build

The frontend build runs with `CI=true`, which treats every ESLint warning as an error. The codebase currently produces **zero warnings**.

```bash
cd frontend
CI=true npm run build
```

Expected last lines:
```
Compiled successfully.

File sizes after gzip:
  xxx.xx kB  build/static/js/main.xxxxxxxx.js
  xxx.xx kB  build/static/css/main.xxxxxxxx.css
```

**If you see "Compiled with warnings" or "Failed to compile":** an ESLint warning was introduced. Common causes:
- New unused import (`no-unused-vars`)
- Missing `useEffect` dependency (`react-hooks/exhaustive-deps`)
- Unused variable declared with `const`/`let`

Fix the warning, then re-run `CI=true npm run build` until it exits clean.

---

## 8. API Verification Checklist

With the dev stack running (`docker compose up -d`):

### Auth flow

```bash
# Register a new user
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","firstName":"Test","lastName":"User"}' | jq .

# Login
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.io","password":"Admin123!"}' | jq .
# → Save the "accessToken" value as TOKEN

# Get current user
curl -s http://localhost:3001/api/auth/me -H "Authorization: Bearer $TOKEN" | jq .
```

### Stations

```bash
curl -s http://localhost:3001/api/stations -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# → 5 (after seeding)
```

### Sensors

```bash
curl -s http://localhost:3001/api/sensors -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# → 15 (after seeding)
```

### Health endpoint

```bash
curl -sv http://localhost:3001/api/health
# HTTP 200 + {"status":"ok",...}
```

### Swagger

Open http://localhost:3001/api/docs in a browser.
Click "Authorize", enter `Bearer <TOKEN>`.
Try any endpoint via the "Try it out" button.

---

## 9. Real-time Smoke Test

With the frontend running at http://localhost:3000 and logged in as admin:

1. Open two browser tabs both at http://localhost:3000/admin/monitoring
2. In another terminal, publish a simulated sensor reading via MQTT:

```bash
# Requires mosquitto-clients installed, or use Docker:
docker exec -it $(docker compose ps -q mosquitto) \
  mosquitto_pub -h localhost -t "aquaflow/sensor/<SENSOR_ID>/data" \
  -m '{"value": 42.5, "unit": "bar", "timestamp": "2026-05-27T12:00:00.000Z"}'
```

Replace `<SENSOR_ID>` with an actual sensor UUID from `GET /api/sensors`.

3. The monitoring page in both tabs should update the sensor's last reading within ~1 second without a page refresh.

---

## 10. Production Deployment

### Prerequisites

- A server with Docker + Docker Compose v2
- A domain with SSL (nginx reverse proxy recommended in front of the stack)
- Access to `.env.example`

### Step 1 — Prepare environment file

```bash
cp .env.example .env.prod
```

Edit `.env.prod` and fill in **all REQUIRED values**:

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong DB password |
| `REDIS_PASSWORD` | Strong Redis password |
| `MQTT_PASSWORD` | MQTT broker password |
| `JWT_SECRET` | 32+ random chars — generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | 32+ random chars — generate: `openssl rand -hex 32` |
| `FRONTEND_URL` | Your domain for CORS, e.g. `https://aquaflow.example.com` |
| `REACT_APP_API_URL` | `https://aquaflow.example.com/api` |
| `REACT_APP_WS_URL` | `https://aquaflow.example.com` |

### Step 2 — Create MQTT password file

```bash
docker run --rm eclipse-mosquitto:2 \
  sh -c "mosquitto_passwd -b /dev/stdout $MQTT_USERNAME $MQTT_PASSWORD" \
  > mosquitto/config/passwd
```

### Step 3 — Build and start the prod stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### Step 4 — Run migrations and seed (first deploy only)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
  sh -c "npm run migration:run"

# Optional: seed demo data
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend \
  sh -c "npm run seed"
```

### Step 5 — Verify health

```bash
curl https://aquaflow.example.com/api/health
# → {"status":"ok","db":{"status":"ok"},"redis":{"status":"ok"}}
```

### Production key differences from dev

| Concern | Dev | Prod |
|---------|-----|------|
| DB port | `5432:5432` (exposed) | Internal only |
| Redis port | `6379:6379` (exposed) | Internal only |
| Redis auth | No password | `--requirepass` set |
| MQTT auth | `allow_anonymous true` | `allow_anonymous false` |
| Backend port | `3001:3001` (exposed) | `expose: 3001` (internal) |
| JWT secrets | Default fallback | Required env vars — fails fast if missing |
| Restart policy | `unless-stopped` | `always` |
| Resource limits | None | CPU + memory limits per service |
| Log rotation | None | json-file, max 20 MB, 3–5 files |

---

## 11. Common Problems and Fixes

### Backend won't start: `ECONNREFUSED 127.0.0.1:5432`

Postgres isn't running or not yet ready. Wait 10 seconds after `docker compose up` and check:
```bash
docker compose ps        # all services should show "healthy" or "running"
docker compose logs postgres
```

### Backend won't start: `ECONNREFUSED 127.0.0.1:6379`

Redis isn't running. Same fix as above.

### Frontend won't start: `npm install` peer dependency errors

Always use `--legacy-peer-deps`:
```bash
npm install --legacy-peer-deps
```

### `CI=true npm run build` fails with ESLint warning

Find the warning:
```bash
cd frontend
npm run build 2>&1 | grep "warning"
```
Fix the reported file (usually an unused import or missing `useEffect` dep), then re-run.

### Jest tests fail: `Cannot find module 'socket.io-client'`

```bash
cd frontend && npm install --legacy-peer-deps
```

### Backend tests fail: `Cannot find module '@nestjs/testing'`

```bash
cd backend && npm install
```

### `docker compose up` fails: port already in use

Something else is using port 3000, 3001, 5432, 6379, or 1883. Find and kill it:
```bash
# Linux/macOS
lsof -ti:3001 | xargs kill
# Windows PowerShell
netstat -ano | findstr :3001
# Then: taskkill /PID <pid> /F
```

### Health endpoint returns HTTP 503

The DB or Redis container isn't healthy yet. Check:
```bash
docker compose ps
docker compose logs redis
docker compose logs postgres
```
Wait for containers to show "healthy" then retry the health check.

### Migration didn't run on first boot

Run it manually:
```bash
cd backend
npm run migration:run
```

Or inside Docker:
```bash
docker compose exec backend npm run migration:run
```

### MQTT messages not triggering sensor updates

1. Check the MQTT broker is running: `docker compose ps mosquitto`
2. Check the topic format: must be `aquaflow/sensor/<sensorId>/data`
3. Check the payload is valid JSON: `{"value": <number>, "timestamp": "<ISO string>"}`
4. Check backend logs for IoT errors: `docker compose logs -f backend | grep -i mqtt`

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev stack | `docker compose up -d` |
| Stop dev stack | `docker compose down` |
| View backend logs | `docker compose logs -f backend` |
| Check health | `curl http://localhost:3001/api/health` |
| Run backend tests | `cd backend && npm test` |
| Run frontend tests | `cd frontend && npm test -- --watchAll=false --forceExit` |
| Verify CI build | `cd frontend && CI=true npm run build` |
| Seed demo data | `cd backend && npm run seed` |
| Run DB migration | `cd backend && npm run migration:run` |
| Open Swagger | http://localhost:3001/api/docs |
| Open app | http://localhost:3000 |
