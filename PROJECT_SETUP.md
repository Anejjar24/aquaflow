# AquaFlow — Developer Setup Guide

> Complete instructions to set up your local development environment from scratch.  
> Covers Windows, macOS, and Linux.

---

## Table of Contents

1. [System requirements](#1-system-requirements)
2. [Install prerequisites](#2-install-prerequisites)
3. [Clone and configure](#3-clone-and-configure)
4. [Start infrastructure with Docker](#4-start-infrastructure-with-docker)
5. [Run backend in dev mode](#5-run-backend-in-dev-mode)
6. [Run frontend in dev mode](#6-run-frontend-in-dev-mode)
7. [Verify the full stack](#7-verify-the-full-stack)
8. [IDE setup (VS Code)](#8-ide-setup-vs-code)
9. [Git workflow](#9-git-workflow)
10. [Environment variables reference](#10-environment-variables-reference)
11. [Common setup errors](#11-common-setup-errors)

---

## 1. System requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB (Spark needs ~2 GB alone) |
| Disk | 10 GB free | 20 GB free |
| OS | Windows 10/11, macOS 12+, Ubuntu 20.04+ | |

> **Windows**: Docker Desktop must use the **WSL 2** backend (not Hyper-V). Enable it in Docker Desktop → Settings → General → "Use WSL 2 based engine".

---

## 2. Install prerequisites

### 2.1 Node.js 18+

```bash
# Using nvm (recommended — lets you switch versions easily)
# Linux / macOS:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 18
nvm use 18

# Windows — use nvm-windows:
# https://github.com/coreybutler/nvm-windows/releases
nvm install 18.20.0
nvm use 18.20.0
```

Verify:
```bash
node --version   # v18.x.x
npm --version    # 9.x.x or higher
```

### 2.2 Docker Desktop

- **Windows / macOS**: download from https://www.docker.com/products/docker-desktop
- **Ubuntu**:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verify:
```bash
docker --version          # Docker version 24.x or higher
docker compose version    # Docker Compose version v2.x
```

### 2.3 Git

```bash
# Ubuntu
sudo apt install git

# macOS
brew install git

# Windows — download from https://git-scm.com/download/win
```

### 2.4 Optional tools (highly recommended)

| Tool | Purpose | Install |
|---|---|---|
| **MQTT Explorer** | Browse MQTT topics visually | https://mqtt-explorer.com |
| **DBeaver** | PostgreSQL / TimescaleDB GUI | https://dbeaver.io |
| **Offset Explorer** | Browse Kafka topics | https://www.kafkatool.com |
| **Python 3.10+** | Run Spark jobs locally | https://python.org |
| **pipenv** or **venv** | Python environment | `pip install pipenv` |

---

## 3. Clone and configure

```bash
# Clone the repository
git clone <repo-url> pfe-project
cd pfe-project
```

### 3.1 Backend environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and **at minimum change**:

```env
JWT_SECRET=replace-this-with-at-least-32-random-characters
JWT_REFRESH_SECRET=replace-this-with-another-32-random-characters
```

All other values work out of the box with the Docker setup.

Full reference: see [Section 10](#10-environment-variables-reference).

### 3.2 Frontend environment

For local development (backend on port 3001), **no `.env` file is needed** — defaults are baked in.

If you want to override:

```bash
# frontend/.env  (optional)
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=http://localhost:3001
```

---

## 4. Start infrastructure with Docker

```bash
# From the project root
docker compose up -d
```

This starts all 13 services. First pull takes a few minutes (images ~5 GB total).

### Monitor startup

```bash
# Watch all container statuses
watch docker compose ps

# Or follow logs from a specific service
docker compose logs -f backend
docker compose logs -f kafka
```

### Expected healthy state (~60 seconds)

```
NAME                         STATUS
aquaflow-postgres            Up (healthy)
aquaflow-redis               Up (healthy)
aquaflow-mosquitto           Up (healthy)
aquaflow-kafka               Up (healthy)
aquaflow-minio               Up (healthy)
aquaflow-minio-init          Exited (0)      ← correct — one-shot init
aquaflow-backend             Up (healthy)
aquaflow-kafka-to-minio      Up
aquaflow-spark-master        Up
aquaflow-spark-worker        Up
aquaflow-spark-anomaly       Up
aquaflow-frontend            Up
```

### Useful Docker commands

```bash
# Stop all services (keeps data volumes)
docker compose stop

# Start again
docker compose start

# Full reset — DELETES ALL DATA
docker compose down -v

# Rebuild backend image after code changes (for full Docker mode)
docker compose build backend
docker compose up -d backend

# View Spark worker logs
docker compose logs -f spark-worker

# Execute a command inside a container
docker exec -it aquaflow-postgres psql -U postgres -d aquaflow
docker exec -it aquaflow-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```

---

## 5. Run backend in dev mode

Running the backend outside Docker gives you **hot reload** (saves ~5 s per change).

```bash
# Stop the Docker backend first
docker compose stop backend

cd backend
npm install

# Start with hot reload
npm run start:dev
```

Backend is available at **http://localhost:3001/api**  
Swagger docs at **http://localhost:3001/api/docs**

### Backend NPM scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Hot reload dev server |
| `npm run start:debug` | Dev server + Node.js debugger |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run compiled production build |
| `npm test` | Run all Jest unit tests |
| `npm run test:cov` | Tests + coverage report |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | ESLint check |
| `npm run typeorm migration:run` | Apply pending migrations |
| `npm run typeorm migration:generate -- -n Name` | Generate migration from entity changes |

> **Note**: when running backend outside Docker, the `.env` `DATABASE_HOST`, `REDIS_HOST`, `KAFKA_BROKERS`, and `MINIO_ENDPOINT` must all point to `localhost` (the default values in `.env.example` are already set this way for dev mode).

---

## 6. Run frontend in dev mode

```bash
# Stop the Docker frontend first
docker compose stop frontend

cd frontend
npm install

# Start Create React App dev server
npm start
```

Frontend is available at **http://localhost:3000**

React dev server proxies `/api` requests to the backend automatically (configured in `package.json` → `"proxy"`).

### Frontend NPM scripts

| Command | Description |
|---|---|
| `npm start` | Dev server with hot reload |
| `npm test` | Jest + React Testing Library |
| `npm run build` | Production build to `build/` |
| `npm run lint` | ESLint check |

### Chart.js version — important

The project uses **Chart.js v2.9.4** with **react-chartjs-2 v2.11.2**.

Do **not** run `npm install chart.js` or `npm install react-chartjs-2` without pinning to v2:

```bash
# Safe — these are already in package.json
# DO NOT upgrade to v3 — it breaks all chart configurations
```

If you accidentally upgrade, rollback with:
```bash
npm install chart.js@2.9.4 react-chartjs-2@2.11.2
```

---

## 7. Verify the full stack

Run through these checks to confirm everything is wired up correctly.

### 7.1 Backend health

```bash
curl http://localhost:3001/api/health
# Expected: {"status":"ok","info":{...}}
```

### 7.2 Database

```bash
docker exec -it aquaflow-postgres psql -U postgres -d aquaflow -c "\dt"
# Expected: list of tables (users, stations, sensors, alerts, ...)
```

### 7.3 TimescaleDB extension

```bash
docker exec -it aquaflow-postgres psql -U postgres -d aquaflow \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'timescaledb';"
# Expected: timescaledb | 2.14.x
```

### 7.4 Kafka topics

```bash
docker exec aquaflow-kafka \
  kafka-topics.sh --bootstrap-server localhost:9092 --list
# Expected: sensors.readings  sensors.anomalies  (may be auto-created on first use)
```

### 7.5 MinIO bucket

Open **http://localhost:9002** → login `aquaflow / aquaflow123` → verify `aquaflow-lake` bucket with `raw/`, `processed/`, `models/` folders.

### 7.6 Spark cluster

Open **http://localhost:8080** → verify 1 worker connected, status: ALIVE.

### 7.7 Register and login

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.io","password":"Admin1234!","firstname":"Admin","lastname":"User"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.io","password":"Admin1234!"}'
# Expected: {"access_token":"eyJ...","refresh_token":"eyJ...","user":{...}}
```

### 7.8 Send a test sensor reading

```bash
# First create a station + sensor via the UI or API (see QUICK_START.md)
# Then publish via MQTT:
docker exec aquaflow-mosquitto \
  mosquitto_pub -h localhost -p 1883 \
  -t "sensors/<sensor-uuid>/data" \
  -m '{"value":4.2}'
```

Check the Dashboard → the sensor's last reading should update within 1 second.

---

## 8. IDE setup (VS Code)

### Recommended extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "firsttris.vscode-jest-runner",
    "ms-azuretools.vscode-docker",
    "rangav.vscode-thunder-client",
    "redhat.vscode-yaml",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### Workspace settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "jest.autoRun": "off"
}
```

### Debug configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
    }
  ]
}
```

Start debug mode with: `npm run start:debug` in the backend directory, then attach VS Code.

---

## 9. Git workflow

### Branches

```
main          ← stable, production-ready
develop       ← integration branch
feature/*     ← new features
fix/*         ← bug fixes
hotfix/*      ← critical production fixes
```

### Commit message format

```
<type>(<scope>): <short description>

<longer description if needed>

Co-Authored-By: Your Name <your@email.com>
```

Types: `feat` · `fix` · `refactor` · `test` · `docs` · `chore`

Scopes: `backend` · `frontend` · `analytics` · `pipeline` · `workflow` · `infra`

Examples:
```
feat(analytics): add Station Detail tab with sensor min/max band chart
fix(backend): add DATE_TRUNC fallback when time_bucket() unavailable
docs: update QUICK_START with Spark job instructions
```

### Pre-push checklist

```bash
# Backend
cd backend && npm test && npm run lint

# Frontend
cd frontend && npm test -- --watchAll=false && npm run lint

# Docker — make sure nothing is broken
docker compose up -d && sleep 30 && docker compose ps
```

---

## 10. Environment variables reference

### `backend/.env`

```env
# ── Database (TimescaleDB on Docker = timescale/timescaledb:2.14.2-pg15) ─────
DATABASE_HOST=localhost          # → postgres  in Docker network
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=aquaflow

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=change-me-at-least-32-chars-xxxxxxxxxxxxxxxx
JWT_REFRESH_SECRET=change-me-refresh-32-chars-xxxxxxxxx
JWT_EXPIRATION=3600              # access token lifetime in seconds (1 h)
JWT_REFRESH_EXPIRATION=604800   # refresh token lifetime in seconds (7 d)

# ── Server ────────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST=localhost             # → redis  in Docker network
REDIS_PORT=6379

# ── MQTT (Eclipse Mosquitto) ─────────────────────────────────────────────────
MQTT_BROKER_URL=mqtt://localhost:1883   # → mqtt://mosquitto:1883  in Docker

# ── Apache Kafka 3.6 (KRaft, no Zookeeper) ──────────────────────────────────
KAFKA_BROKERS=localhost:9092     # → kafka:9092  in Docker network

# ── MinIO (S3-compatible data lake) ─────────────────────────────────────────
MINIO_ENDPOINT=http://localhost:9000    # → http://minio:9000  in Docker
MINIO_ACCESS_KEY=aquaflow
MINIO_SECRET_KEY=aquaflow123
MINIO_BUCKET=aquaflow-lake

# ── Email (optional) ─────────────────────────────────────────────────────────
# MAIL_HOST=smtp.gmail.com
# MAIL_PORT=587
# MAIL_USER=your@gmail.com
# MAIL_PASS=your-app-password
```

### `frontend/.env` (optional — only needed to override defaults)

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=http://localhost:3001
```

---

## 11. Common setup errors

### `Error: Cannot find module '@nestjs/core'`
```bash
cd backend && rm -rf node_modules && npm install
```

### `Error: ECONNREFUSED 127.0.0.1:5432` (backend can't reach DB)
```bash
# Check postgres container is healthy
docker compose ps postgres
# If not running:
docker compose up -d postgres
# If running but backend is in dev mode: ensure DATABASE_HOST=localhost in .env
```

### Kafka `LEADER_NOT_AVAILABLE` on first start
```bash
docker compose restart kafka
# Wait 20 seconds then retry
```

### `minio-init` container shows exit code 1
```bash
# Re-run the init manually
docker compose run --rm minio-init
```

### `time_bucket does not exist` SQL error
The TimescaleDB extension was not loaded. Check:
```bash
docker exec aquaflow-postgres psql -U postgres -d aquaflow \
  -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
```
The `postgres/init/01_extensions.sql` file should have done this automatically on first boot.

### Frontend blank page after `npm start`
1. Open browser DevTools → Console
2. Check for `401 Unauthorized` → token expired, log in again
3. Check for `Network Error` → backend not running or wrong `REACT_APP_API_URL`
4. Check for `Chart is not a constructor` → Chart.js version mismatch

### Spark worker shows `DEAD` in UI
```bash
docker compose restart spark-worker
# If still dead, check memory:
docker stats aquaflow-spark-worker
# Increase memory in docker-compose.yml: SPARK_WORKER_MEMORY=2G
```

### Port already in use
```bash
# Find what is using port 3001
# Windows:
netstat -ano | findstr :3001
# Linux / macOS:
lsof -i :3001

# Kill the process or stop the Docker container:
docker compose stop backend
```

---

## Service quick-reference card

```
┌─────────────────────────────────────────────────────────────────┐
│  AquaFlow Local Services                                        │
├─────────────────────┬──────────────────────────────────────────┤
│  Frontend (UI)      │  http://localhost:3000                    │
│  Backend API        │  http://localhost:3001/api                │
│  Swagger docs       │  http://localhost:3001/api/docs           │
│  MinIO console      │  http://localhost:9002                    │
│                     │  user: aquaflow / pass: aquaflow123        │
│  Spark master UI    │  http://localhost:8080                    │
├─────────────────────┼──────────────────────────────────────────┤
│  PostgreSQL/TSB     │  localhost:5432                           │
│                     │  user: postgres / pass: postgres          │
│                     │  db: aquaflow                             │
│  Redis              │  localhost:6379                           │
│  MQTT               │  localhost:1883                           │
│  Kafka              │  localhost:9092                           │
│  MinIO S3 API       │  localhost:9000                           │
│  Spark master       │  localhost:7077                           │
└─────────────────────┴──────────────────────────────────────────┘
```

---

*Last updated: 2026-06-09 · AquaFlow v2.0*
