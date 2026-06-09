# AquaFlow — Quick Start Guide

> **Goal**: get the platform running from zero, create your first station and sensor, and see live data flowing end-to-end.  
> **Time**: ~15 minutes.

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Docker Desktop | 20.10+ | `docker --version` |
| Docker Compose | 2.x | `docker compose version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | any | `git --version` |
| RAM available | **8 GB** (12 GB recommended for Spark) | Task Manager / `free -h` |

> **Windows users**: enable WSL 2 backend in Docker Desktop settings for best performance.

---

## Step 1 — Clone & configure

```bash
# Clone the repository
git clone <repo-url> pfe-project
cd pfe-project

# Copy the backend environment template
cp backend/.env.example backend/.env
```

Open `backend/.env` and set at minimum:

```env
JWT_SECRET=any-32-character-string-you-choose
JWT_REFRESH_SECRET=another-32-character-string-here
```

Everything else works with the defaults for local development.

The frontend needs no `.env` for local dev — the default `http://localhost:3001/api` is baked in.

---

## Step 2 — Start all services

```bash
docker compose up -d
```

This brings up **13 containers**. Wait for them all to become healthy (~45–60 seconds on first boot):

```bash
# Watch health status
docker compose ps

# Or watch logs as they start
docker compose logs -f backend
```

Expected final state:

```
aquaflow-postgres        running (healthy)
aquaflow-redis           running (healthy)
aquaflow-mosquitto       running (healthy)
aquaflow-kafka           running (healthy)
aquaflow-minio           running (healthy)
aquaflow-minio-init      exited (0)          ← one-shot, exit 0 is correct
aquaflow-backend         running (healthy)
aquaflow-kafka-to-minio  running
aquaflow-spark-master    running
aquaflow-spark-worker    running
aquaflow-spark-anomaly   running
aquaflow-frontend        running
```

> **Kafka first boot**: KRaft initialisation can take up to 30 seconds.  
> If kafka shows `unhealthy`, run `docker compose restart kafka` once.

---

## Step 3 — Open the application

| Interface | URL | Notes |
|---|---|---|
| **AquaFlow frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:3001/api | REST endpoints |
| **Swagger / API docs** | http://localhost:3001/api/docs | Interactive API explorer |
| **MinIO console** | http://localhost:9002 | Data lake browser |
| **Spark master UI** | http://localhost:8080 | Spark cluster status |

---

## Step 4 — Create your first account

1. Go to **http://localhost:3000**
2. Click **Register** (or **Sign Up**)
3. Fill in your name, email and password
4. The first account created can be promoted to **admin** via the API:

```bash
# Promote your user to admin (replace the email)
curl -X PATCH http://localhost:3001/api/users/promote \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","role":"admin"}'
```

Or log in and use the Users section in the admin panel.

---

## Step 5 — Create a station and sensor

### Via the UI

1. Navigate to **Stations** in the sidebar
2. Click **+ New Station**
3. Fill in name, location, and GPS coordinates (lat/lon)
4. Click **Save**

5. Open the station → click **+ Add Sensor**
6. Choose type (e.g. `pressure`), set unit (`bar`), set thresholds
7. Copy the sensor **UUID** — you'll need it to send test data

### Via the API (curl)

```bash
# 1. Login and get your token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Create a station
STATION_ID=$(curl -s -X POST http://localhost:3001/api/stations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Station Nord",
    "location": "Zone industrielle nord",
    "latitude": 36.7372,
    "longitude": 3.0865,
    "capacity": 5000,
    "type": "pumping"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Station ID: $STATION_ID"

# 3. Create a pressure sensor
SENSOR_ID=$(curl -s -X POST http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Pressure-01\",
    \"type\": \"pressure\",
    \"unit\": \"bar\",
    \"minThreshold\": 1.5,
    \"maxThreshold\": 8.0,
    \"stationId\": \"$STATION_ID\"
  }" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Sensor ID: $SENSOR_ID"
```

---

## Step 6 — Send test sensor data

### Option A — MQTT (simulates a real IoT device)

```bash
# Install mosquitto clients if not available
# Ubuntu: sudo apt install mosquitto-clients
# Windows: use MQTT Explorer (GUI) or Docker

# Publish a reading to the sensor's MQTT topic
docker exec aquaflow-mosquitto \
  mosquitto_pub -h localhost -p 1883 \
  -t "sensors/$SENSOR_ID/data" \
  -m '{"value": 4.2, "unit": "bar", "timestamp": "2026-06-09T10:00:00Z"}'
```

### Option B — Direct API injection

```bash
# Inject a reading directly via the REST API
curl -X POST "http://localhost:3001/api/sensors/$SENSOR_ID/inject" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": 4.2}'
```

### Option C — Bulk simulation script

```bash
# Run 50 readings over 50 seconds (simulates live sensor)
for i in $(seq 1 50); do
  VALUE=$(python3 -c "import random; print(round(random.uniform(2.0, 7.5), 2))")
  docker exec aquaflow-mosquitto \
    mosquitto_pub -h localhost -p 1883 \
    -t "sensors/$SENSOR_ID/data" \
    -m "{\"value\": $VALUE}"
  sleep 1
done
```

After a few readings you will see:
- **Live values** updating in the Monitoring module
- **Alert triggered** if a value crosses min/max threshold
- **Data appearing** on the Analytics dashboard

---

## Step 7 — Explore the Analytics Operator Workbench

Navigate to **Analytics** in the sidebar. You will see the **Operator Workbench** with 4 tabs:

### Tab 1 — Overview
- Station Health Grid: colour-coded cards, sensor health bars, open alert badges
- Alerts by Severity doughnut chart
- 6-Hour Network Activity line chart (auto-updates)
- Recent Alert Feed

### Tab 2 — Anomaly Detection
- Select period: 24 h / 7 d / 30 d
- Events by Station and Events by Type horizontal bar charts
- Full event timeline table with z-score column
- Statistical detail (populated after Spark batch job runs)

### Tab 3 — Trends & History
- Network-wide trend line chart with dual Y-axis
- Top sensors by measurement volume
- **Network Outlook** — automatic heuristic insight cards
- Event frequency bar chart over time

### Tab 4 — Station Detail
1. Choose a station from the dropdown
2. See all-sensor trend chart
3. Pick a specific sensor → see avg/min/max/stddev cards
4. Sensor detail chart with shaded min/max band and threshold lines
5. Station event history table

---

## Step 8 — Build your first workflow

Navigate to **Automation** in the sidebar.

1. Click **+ New Workflow**
2. Name it (e.g. "High Pressure Alert")
3. The **JointJS canvas** opens
4. Drag blocks from the left panel:
   - **Sensor Trigger** → configure sensorId + threshold operator
   - Connect output → **Threshold Check**
   - Connect → **Alert Sender** (set severity and message)
   - Connect → **Notification Sender**
5. Click **Save**
6. Click **Execute** (manual trigger) or set a **Cron schedule**

### Available trigger types
| Type | Config |
|---|---|
| Manual | Click Execute button |
| Scheduled | Set a cron expression (e.g. `0 8 * * *` = every day at 08:00) |
| Sensor Threshold | Fires when MQTT reading crosses your configured threshold |

---

## Step 9 — Run the Spark batch KPI job

The streaming anomaly detector runs automatically. The batch KPI aggregation is run on demand:

```bash
# SSH into the Spark master container
docker exec -it aquaflow-spark-master bash

# Run the aggregation job
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-jobs/aggregate_sensor_kpis.py

exit
```

After the job completes:
- `sensor_aggregates` table is populated
- Analytics Tab 2 → "Statistical Anomaly Detail" section shows data
- MinIO `processed/hourly/` and `processed/daily/` contain Parquet output

---

## Step 10 — Verify the full pipeline

```bash
# 1. Check Kafka topics exist
docker exec aquaflow-kafka \
  kafka-topics.sh --bootstrap-server localhost:9092 --list

# Expected: sensors.readings  sensors.anomalies

# 2. Check MinIO bucket structure
docker exec aquaflow-minio-init true 2>/dev/null || \
  docker run --rm --network pfe-project_aquaflow-network \
    -e MC_HOST_local=http://aquaflow:aquaflow123@minio:9000 \
    minio/mc ls local/aquaflow-lake

# 3. Check TimescaleDB continuous aggregates
docker exec aquaflow-postgres psql -U postgres -d aquaflow -c \
  "SELECT * FROM sensor_data_hourly ORDER BY bucket DESC LIMIT 5;"

# 4. Check backend health
curl http://localhost:3001/api/health

# 5. Check Spark workers
# Open http://localhost:8080 in browser
```

---

## Common commands

### Development (without Docker)

```bash
# Backend — start dev server with hot reload
cd backend
npm install
npm run start:dev           # → http://localhost:3001

# Frontend — start dev server
cd frontend
npm install
npm start                   # → http://localhost:3000
```

### Docker management

```bash
# Start all services
docker compose up -d

# Stop all (keep data)
docker compose stop

# Full reset — WARNING: deletes all data volumes
docker compose down -v

# View all logs
docker compose logs -f

# View one service's logs
docker compose logs -f backend
docker compose logs -f spark-anomaly

# Restart one service
docker compose restart kafka
```

### Backend CLI

```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Build for production
npm run build

# TypeORM — generate migration from entity changes
npm run typeorm migration:generate -- -n DescriptiveName

# TypeORM — run pending migrations
npm run typeorm migration:run
```

### Frontend CLI

```bash
cd frontend

# Run tests
npm test

# Build for production
npm run build

# Analyse bundle size
npm run build -- --stats && npx webpack-bundle-analyzer build/bundle-stats.json
```

### MinIO — manage the data lake

```bash
# Open console in browser
open http://localhost:9002          # login: aquaflow / aquaflow123

# Or use the mc CLI inside Docker
docker exec -it aquaflow-minio sh
mc alias set local http://localhost:9000 aquaflow aquaflow123
mc ls local/aquaflow-lake           # list bucket contents
mc cp local/aquaflow-lake/raw/sensors/somefile.parquet /tmp/   # download
```

### Spark — run jobs manually

```bash
# Smoke test — reads raw Parquet, prints schema
docker exec aquaflow-spark-master \
  spark-submit --master spark://spark-master:7077 \
  /opt/spark-jobs/base_job.py

# Batch KPI aggregation
docker exec aquaflow-spark-master \
  spark-submit --master spark://spark-master:7077 \
  /opt/spark-jobs/aggregate_sensor_kpis.py
```

---

## Troubleshooting quick-reference

| Problem | Fix |
|---|---|
| Port 3000 already in use | `docker compose stop frontend` then `npm start` from `frontend/` |
| Kafka health-check failing | `docker compose restart kafka` (KRaft init race) |
| `minio-init` exited with error | `docker compose run --rm minio-init` |
| Backend can't connect to DB | Wait 15 more seconds; DB health-check takes time on first boot |
| No data in Analytics | Send test MQTT data (Step 6) |
| `time_bucket` SQL error | TimescaleDB extension not loaded — check `postgres/init/` SQL files |
| Spark job OOM | Increase `SPARK_WORKER_MEMORY` in `docker-compose.yml` |
| Frontend blank / white page | Open DevTools console; likely an API URL mismatch in `.env` |

---

## Next steps

- Read **[AQUAFLOW_ARCHITECTURE.md](./AQUAFLOW_ARCHITECTURE.md)** for deep design decisions
- Read **[WORKFLOW_BUILDER_COMPLETE.md](./WORKFLOW_BUILDER_COMPLETE.md)** for the workflow builder reference
- Read **[docs/industrial-blocks-guide.md](./docs/industrial-blocks-guide.md)** for block-by-block documentation
- Set up a production deployment using **[docker-compose.prod.yml](./docker-compose.prod.yml)**

---

*Last updated: 2026-06-09 · AquaFlow v2.0*
