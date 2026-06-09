# AquaFlow — Manual Test Guide V2

**Covers:** Tasks 7–18 + StationDetailsPage gap fix  
**Based on:** CURRENT_PROJECT_STATE.md (pre-session audit) + TASK_7 through TASK_18 reports  
**Date:** 2026-05-13  
**Stack:** NestJS 10 backend · React 18 / Argon Dashboard frontend · PostgreSQL · Redis (optional) · Mosquitto MQTT

---

## How to Use This Guide

- Work through each section in order; later sections may depend on data created earlier.
- Every section ends with a **pass/fail checkbox** — mark it before moving on.
- **Notes** lines are for recording the actual error, screenshot filename, or deviation from the expected result.
- Tasks 7–10 are pure frontend or data-layer changes; Tasks 12–18 cover backend, infrastructure, and integration features.

---

## Global Prerequisites

### A. Seed credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@aquaflow.local` | `Admin123!` |
| Operator | `operator@aquaflow.local` | `Operator123!` |
| Technician | `technician@aquaflow.local` | `Tech123!` |
| Analyst | `analyst@aquaflow.local` | `Analyst123!` |

### B. Start the stack (development mode)

```bash
# From project root — start infrastructure
docker compose up -d postgres redis mosquitto

# Backend (in a separate terminal)
cd backend
npm run start:dev

# Frontend (in a separate terminal)
cd frontend
npm start
```

Wait until:
- Backend log shows `NestJS application is running on: http://[::1]:3001`
- Frontend opens at `http://localhost:3000`

### C. Seed the database (first run only)

```bash
cd backend
npm run seed
```

Expected output: lines confirming users, stations, sensors, and alerts were created.

### D. URL conventions

| Resource | URL |
|----------|-----|
| Frontend | `http://localhost:3000` (HashRouter — routes are `http://localhost:3000/#/admin/...`) |
| Backend API | `http://localhost:3001/api` |
| Swagger UI | `http://localhost:3001/api/docs` |

---

## Section 1 — Monitoring Page: Edit & Delete Sensors (Task 7 — P4)

### 1.1 Role-based action visibility

1. Log in as **admin** (`admin@aquaflow.local` / `Admin123!`).
2. Click **Monitoring** in the sidebar.
3. Verify the sensor table has the columns: Name, Station, Type, Status, Last Reading, Thresholds, **Actions**.
4. In the Actions column, verify each row shows **View**, **Edit**, and **Delete** buttons.
5. Log out. Log in as **operator** (`operator@aquaflow.local` / `Operator123!`).
6. Navigate to Monitoring. Verify each row shows **View** and **Edit** buttons but **no Delete** button.
7. Log out. Log in as **analyst** (`analyst@aquaflow.local` / `Analyst123!`).
8. Navigate to Monitoring. Verify the Actions column shows only **View** (no Edit, no Delete).

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 1.2 Edit a sensor

1. Log in as **admin**.
2. Navigate to **Monitoring**.
3. Click **Edit** on any sensor row.
4. Verify the modal title reads **"Edit Sensor"** and all fields are pre-filled with that sensor's current data.
5. Change the **Max Threshold** field to a new value (e.g., `9.5`).
6. Click **Update Sensor** (submit button inside the modal).
7. Verify the modal closes and the row in the table reflects the updated threshold (Thresholds column shows new value).
8. No page reload should occur.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 1.3 Delete a sensor

1. Log in as **admin**.
2. Navigate to **Monitoring**.
3. Note the sensor count shown (number of rows).
4. Click **Delete** on any sensor row.
5. Verify a confirmation modal appears with the header **"Delete Sensor"**, showing the sensor name and the text "This action cannot be undone."
6. Click **Cancel** → verify the modal closes, sensor is still in the list.
7. Click **Delete** again on the same sensor → click **Delete** in the confirmation modal.
8. Verify the sensor disappears from the list without a page reload, and the row count decreases by 1.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 1.4 API guard verification

Run from a terminal (substitute a real sensor UUID from step 1.2 above):

```bash
# 401 without token
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH http://localhost:3001/api/sensors/SENSOR_ID \
  -H "Content-Type: application/json" \
  -d '{"maxThreshold":9.9}'
# Expected: 401

# 401 without token on DELETE
curl -s -o /dev/null -w "%{http_code}\n" \
  -X DELETE http://localhost:3001/api/sensors/SENSOR_ID
# Expected: 401
```

| Test | Expected | Actual |
|------|----------|--------|
| PATCH without token | 401 | ___ |
| DELETE without token | 401 | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 2 — Sensor Details Page & Historical Chart (Task 8 — P5)

### 2.1 Navigation to detail page

1. Log in as **analyst** (read-only role to confirm universal access).
2. Navigate to **Monitoring**.
3. Verify every sensor row has a **View** button (visible to all roles).
4. Click **View** on any sensor.
5. Verify the browser URL changes to `http://localhost:3000/#/admin/monitoring/<uuid>`.
6. Verify the page renders within 3 seconds (no blank screen).

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 2.2 KPI cards and metadata

1. On the Sensor Details page, verify the following **4 KPI cards** are visible:
   - **Current Reading** — shows a numeric value and unit (or `—` if no data).
   - **Average** — numeric or `—`.
   - **Min Threshold** — shows the configured threshold or `—`.
   - **Max Threshold** — shows the configured threshold or `—`.
2. Below the KPI cards, verify the **sensor metadata table** shows:
   - Device ID, Serial Number, Location, Alert Enabled, Last Reading, Station.
3. Verify the **Back to Monitoring** button is present.
4. Click **Back to Monitoring** → verify navigation returns to `/admin/monitoring`.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 2.3 Historical chart

1. Open the Sensor Details page for a sensor that has historical data (seeded sensors should have readings).
2. Verify a **line chart** is rendered with:
   - A solid blue line for actual readings (left = oldest, right = newest).
   - A **green dashed line** for the minimum threshold (only if `minThreshold` is set).
   - A **red dashed line** for the maximum threshold (only if `maxThreshold` is set).
3. Verify the **limit buttons** are visible: **50**, **100**, **200**, **500**.
4. Click **50** → chart re-fetches and shows at most 50 data points.
5. Click **200** → chart re-fetches with more points.

| Test | Expected | Actual |
|------|----------|--------|
| Chart renders | Blue line visible | ___ |
| Threshold lines | Dashed lines present (if configured) | ___ |
| Limit 50 | Chart updates | ___ |
| No data sensor | "No historical readings available" message | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 3 — Station Details Page (Gap Fix)

### 3.1 Navigation from Stations list

1. Log in as **admin**.
2. Navigate to **Stations** (`#/admin/stations`).
3. Verify each station row in the table has a **View** button (visible to all roles).
4. Click **View** on any station row.
5. Verify the URL changes to `http://localhost:3000/#/admin/stations/<uuid>`.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 3.2 KPI cards

On the Station Details page, verify 4 KPI cards appear in the header:

| Card title | Content |
|------------|---------|
| **Status** | Shows the station's status (e.g., `normal`, `warning`, `critical`) |
| **Sensors** | Integer count of sensors attached to the station |
| **Active Alerts** | Count of alerts with status = `active`; icon turns red if > 0 |
| **Capacity** | Formatted number + capacity unit (e.g., `48,000 m3/day`) |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 3.3 Station metadata panel

1. Verify the left panel shows a card with the station name and a status badge.
2. Verify the metadata rows show: **Type**, **Location**, **Latitude**, **Longitude**, **Capacity**, **Description** (if set), **Created** date.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 3.4 Sensors and alerts tables

1. Verify the **Sensors** table shows columns: Name, Type, Value, Status, Updated.
2. If the station has no sensors, verify the message "No sensors attached to this station." appears.
3. Verify the **Recent Alerts** table shows columns: Severity, Message, Status, Created.
4. If the station has no alerts, verify "No alerts for this station." appears.
5. Click **Back to Stations** → verify navigation returns to `/admin/stations`.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 4 — uiSlice: Sidebar State Persistence (Task 9 — P6)

### 4.1 Sidebar collapse persists across navigation

1. Log in as any user.
2. Click the collapse arrow (≡ hamburger) in the left sidebar.
3. Verify the sidebar shrinks to icon-only mode.
4. Click **Dashboard** in the nav → navigate to another page.
5. Verify the sidebar remains collapsed (does not re-expand on navigation).
6. Click the collapse arrow again → sidebar expands.
7. Navigate to another page → verify it remains expanded.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 4.2 Redux DevTools verification (optional — requires browser extension)

1. Install the Redux DevTools browser extension if not already installed.
2. Log in → open DevTools → Redux tab.
3. Verify the initial state includes: `ui: { sidebarMini: false, theme: "light", notifications: [] }`.
4. Click the sidebar collapse → verify a `ui/toggleSidebarMini` action appears and `sidebarMini` flips to `true`.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 5 — Industrial Workflow Blocks (Task 10 — P7)

### 5.1 New blocks appear in the builder

1. Log in as **admin**.
2. Navigate to **Automation Builder** (`#/admin/builder`).
3. In the left **Block panel**, verify the following category and blocks are listed:

| Category | Block name |
|----------|-----------|
| **Industrial** | Sensor Read |
| **Industrial** | Threshold Check |
| **Industrial** | Pump Control |
| **Industrial** | Alert Trigger |
| **Industrial** | MQTT Publish |
| **Industrial** | Station Control |
| **Integration** | HTTP Request |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 5.2 Block drag and properties panel

1. Drag **Sensor Read** from the panel onto the canvas.
2. Verify a blue node appears with a `trigger` input port and `value` / `status` output ports.
3. Click the node → verify the **Properties panel** shows fields: **Label** and **sensorId**.
4. Drag **Threshold Check** onto the canvas.
5. Verify an amber node with `value` input and `pass` / `breach` output ports.
6. Click the node → verify Properties shows: **Label**, **minThreshold**, **maxThreshold**, **mode** (dropdown: between/above_max/below_min).
7. Drag **Alert Trigger** onto the canvas → verify a red node.
8. Click it → verify Properties shows: **Label**, **severity** (select), **type** (select), **message** (textarea), **stationId** (optional).
9. Drag **Pump Control** → verify an indigo node with `trigger` input and `sent` output.
10. Drag **MQTT Publish** → verify a violet node.
11. Drag **Station Control** → verify an emerald node.
12. Drag **HTTP Request** → verify an orange node with `body` input and `response`/`error` outputs.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 5.3 Block search

1. Type `"pump"` in the block search bar → verify only **Pump Control** appears.
2. Clear and type `"mqtt"` → verify only **MQTT Publish** appears.
3. Clear and type `"sensor"` → verify **Sensor Read** appears in results.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 6 — Analytics Backend Module (Task 12 — P9)

### 6.1 Auth guard on analytics endpoints

```bash
# All three endpoints must return 401 without a token
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/analytics/overview
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/analytics/sensors/ANY_ID/stats
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/analytics/stations/ANY_ID/history
```

All three expected: **401**

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 6.2 Overview endpoint

```bash
# Get a token first
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.local","password":"Admin123!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Overview
curl -s http://localhost:3001/api/analytics/overview \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Verify the response contains all these keys:

| Key | Type |
|-----|------|
| `totalStations` | integer ≥ 0 |
| `activeSensors` | integer ≥ 0 |
| `openAlerts` | integer ≥ 0 |
| `maintenancePending` | integer ≥ 0 |
| `stationsByStatus` | array |
| `alertsBySeverity` | array |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 6.3 Sensor stats endpoint

```bash
# Get a sensor ID
SENSOR_ID=$(curl -s http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

# Stats (default last 24h)
curl -s "http://localhost:3001/api/analytics/sensors/$SENSOR_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Verify response contains `sensor`, `period`, `stats` (with `avg`, `min`, `max`, `count`, `stddev`), and `timeSeries` array.

```bash
# Non-existent sensor → 404
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:3001/api/analytics/sensors/00000000-0000-0000-0000-000000000000/stats" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 6.4 Station history endpoint

```bash
STATION_ID=$(curl -s http://localhost:3001/api/stations \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

# Hourly granularity
curl -s "http://localhost:3001/api/analytics/stations/$STATION_ID/history?granularity=hour" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# Daily granularity
curl -s "http://localhost:3001/api/analytics/stations/$STATION_ID/history?granularity=day" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Verify response contains `station`, `period` (with `granularity`), and `sensors` array. Each sensor entry has `sensorId`, `sensorName`, `unit`, and `buckets`.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 7 — Analytics Frontend Page (Task 13 — P10)

### 7.1 Page loads and sidebar link

1. Log in as any user.
2. Verify **Analytics** appears in the sidebar with a pie chart icon.
3. Click **Analytics** → URL becomes `#/admin/analytics`.
4. Verify the 4 KPI cards in the header load within 5 seconds: **Total Stations**, **Active Sensors**, **Open Alerts**, **Maintenance Pending**.
5. Verify **Open Alerts** card background is red if count > 0, green otherwise.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 7.2 Doughnut charts

1. On the Analytics page, scroll past the KPI header.
2. Verify the **Stations by Status** card contains a doughnut chart with colour-coded segments and a legend showing status labels and counts.
3. Verify the **Active Alerts by Severity** card shows a similar doughnut.
4. Click the **refresh icon** (↺) on the Stations by Status card → data re-fetches (spinner briefly appears).

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 7.3 Sensor analysis section

1. Locate the **Sensor Analysis** section (below the doughnut charts).
2. Verify a **sensor dropdown** is present showing sensor names, units, and station names.
3. Select any sensor from the dropdown.
4. Verify 5 **stat cards** appear: **Avg**, **Min**, **Max**, **Readings**, **Std Dev**.
5. Verify a **line chart** renders with:
   - A solid blue fill line for average values.
   - A green dashed line for min values.
   - A red dashed line for max values.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 7.4 Time range controls

1. With a sensor selected, click the **7 d** preset button → chart re-fetches automatically.
2. Click **30 d** → chart updates to show 30-day window.
3. Click **Custom** → verify **From** and **To** datetime-local pickers appear.
4. Set From to 7 days ago and To to now → verify the chart updates.
5. Click **24 h** → custom pickers disappear, chart returns to 24-hour window.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 8 — Redis Cache (Task 14 — P11)

### 8.1 Sensor list caching (in-memory fallback, no Redis required)

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.local","password":"Admin123!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# First call (cache miss — may be slightly slower)
time curl -s http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" > /dev/null

# Second call (cache hit — should be faster or equal)
time curl -s http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" > /dev/null
```

Both calls should return 200. The second call typically responds faster (from cache). The exact timing depends on system load; the key test is that both return the same data.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 8.2 Cache invalidation on create

```bash
# Get total count before
BEFORE=$(curl -s http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; print(json.load(sys.stdin)['meta']['total'])")

# Get a valid station ID
STATION_ID=$(curl -s http://localhost:3001/api/stations \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

# Create a test sensor (invalidates cache)
curl -s -X POST http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Cache Test Sensor\",\"type\":\"pressure\",\"unit\":\"bar\",\"stationId\":\"$STATION_ID\"}" | python -m json.tool

# Re-fetch (must show new total, not stale cached value)
AFTER=$(curl -s http://localhost:3001/api/sensors \
  -H "Authorization: Bearer $TOKEN" | python -c "import sys,json; print(json.load(sys.stdin)['meta']['total'])")

echo "Before: $BEFORE  After: $AFTER"
# Expected: After = Before + 1
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 8.3 Refresh token denylist on logout

```bash
# Login and save BOTH tokens
TOKENS=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@aquaflow.local","password":"Operator123!"}')
ACCESS=$(echo $TOKENS | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
REFRESH=$(echo $TOKENS | python -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")

# Logout WITH the refresh token in the body
curl -s -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}"
# Expected: { "message": "Logged out successfully" }

# Attempt to use the denylisted refresh token → must be rejected
curl -s -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | python -m json.tool
# Expected: 401 { "message": "Refresh token has been revoked" }
```

| Test | Expected | Actual |
|------|----------|--------|
| Logout response | `{ "message": "Logged out successfully" }` | ___ |
| Refresh with revoked token | 401 + "Refresh token has been revoked" | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 8.4 Token rotation on refresh

```bash
# Login fresh
TOKENS=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@aquaflow.local","password":"Operator123!"}')
REFRESH=$(echo $TOKENS | python -c "import sys,json; print(json.load(sys.stdin)['refresh_token'])")

# Refresh → should get NEW token pair
NEW_TOKENS=$(curl -s -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}")
echo $NEW_TOKENS | python -m json.tool
# Expected: 200 with new access_token + refresh_token

# The OLD refresh token must now be denylisted
curl -s -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | python -m json.tool
# Expected: 401
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 9 — Docker Compose Full-Stack Build (Task 15 — P12)

> **Note:** This section requires Docker Desktop to be running. It builds production images and may take 5–10 minutes the first time.

### 9.1 Compose file validation

```bash
cd C:\Users\DELL\Downloads\pfe-project
docker compose config --quiet
echo "Exit code: $?"
# Expected: Exit code 0 (version warning is cosmetic, not a failure)
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 9.2 Full-stack build

```bash
cd C:\Users\DELL\Downloads\pfe-project
docker compose up --build -d
```

Wait until all containers are healthy, then verify:

```bash
docker compose ps
```

| Service | State | Port |
|---------|-------|------|
| `aquaflow-postgres` | `healthy` | 5432 |
| `aquaflow-redis` | `healthy` | 6379 |
| `aquaflow-mosquitto` | running | 1883, 9001 |
| `aquaflow-backend` | running | 3001 |
| `aquaflow-frontend` | running | 3000→80 |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 9.3 Backend reachable from Docker

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/auth/login
# Expected: 400 (body validation) — confirms the route is reachable
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 9.4 Frontend served by nginx

1. Open `http://localhost:3000` in a browser.
2. Verify the AquaFlow login page loads (served by nginx, not the dev server).
3. Log in as admin → verify the dashboard loads with data.

```bash
# Verify nginx serves with gzip
curl -s -I -H "Accept-Encoding: gzip" http://localhost:3000 | grep -i "content-encoding"
# Expected: content-encoding: gzip (or empty if file is already tiny)
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 9.5 SPA routing works in nginx

1. With the Dockerised frontend running (`http://localhost:3000`), log in.
2. Navigate to `http://localhost:3000/#/admin/analytics` — verifies HashRouter routing.
3. Hard-refresh the page (Ctrl+R) — verify it does not return a 404.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 9.6 Stop containers

```bash
docker compose down
# Verify exit code 0 and all containers removed
docker compose ps   # should show nothing
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 10 — Swagger / OpenAPI Documentation (Task 16 — P13)

> For this section the backend must be running locally or in Docker.

### 10.1 Swagger UI is accessible

1. Open `http://localhost:3001/api/docs` in a browser.
2. Verify the page title reads **"AquaFlow API"**.
3. Verify 7 tag groups appear: **auth**, **stations**, **sensors**, **alerts**, **maintenance**, **flows**, **analytics**.
4. Verify the **Authorize** button (🔒) is visible in the top-right area.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 10.2 JWT authorization in the UI

1. Open `http://localhost:3001/api/docs`.
2. Click **Authorize**.
3. Paste a valid `access_token` (obtain via `POST /auth/login` from the terminal or from a login in the app).
4. Click **Authorize** then **Close**.
5. Expand the **stations** tag → click `GET /api/stations` → click **Try it out** → **Execute**.
6. Verify response code is **200** with a JSON array.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 10.3 Protected endpoint rejects unauthenticated requests

1. Click **Authorize** → **Logout** to clear the token.
2. Try `GET /api/stations` → **Execute**.
3. Verify response code is **401**.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 10.4 JSON spec download

```bash
curl -s http://localhost:3001/api/docs-json | python -c "import sys,json; d=json.load(sys.stdin); print(d['info']['title'], d['info']['version'])"
# Expected: AquaFlow API 1.0
```

Verify the output contains all 7 tags:

```bash
curl -s http://localhost:3001/api/docs-json | python -c "import sys,json; [print(t['name']) for t in json.load(sys.stdin)['tags']]"
# Expected lines: auth, stations, sensors, alerts, maintenance, flows, analytics
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 10.5 Endpoint coverage count

```bash
curl -s http://localhost:3001/api/docs-json | python -c "
import sys, json
d = json.load(sys.stdin)
count = sum(len(methods) for path, methods in d['paths'].items())
print('Total endpoints documented:', count)
"
# Expected: 31 (or more if new endpoints were added)
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 11 — Notifications Module (Task 17 — P14)

### 11.1 Notification bell in navbar

1. Log in as **admin**.
2. Verify the **bell icon** (🔔) is visible in the top navbar, to the left of the user avatar.
3. When unread notifications exist (created by alerts), verify a **red badge** appears on the bell showing the unread count.
4. Click the bell → verify a dropdown opens.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.2 Notification dropdown content

1. With the dropdown open, verify:
   - The header row shows **"Notifications"** and the unread count badge.
   - If unread count > 0, a **"Mark all read"** link appears on the right of the header.
   - Each notification item shows: severity icon (colour-coded), title/message text, and a relative timestamp (e.g., "2m ago").
   - Unread items have a slightly highlighted background.
   - A **"Mark read"** button appears next to each unread item.
   - The footer shows **"View all notifications"** link.
2. If no notifications exist, verify **"No notifications"** message appears.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.3 Mark a single notification as read

1. Ensure at least one unread notification exists (create an alert via API if needed — see step 11.4).
2. Click the bell → locate an unread item.
3. Click **Mark read** on that item.
4. Verify the item's **"Mark read"** button disappears (or item loses its highlight).
5. Verify the **unread count badge** on the bell decrements by 1.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.4 Create an alert via API and observe real-time notification

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.local","password":"Admin123!"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X POST http://localhost:3001/api/alerts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "threshold_violation",
    "severity": "critical",
    "message": "Manual test alert - critical pressure"
  }' | python -m json.tool
```

1. With the frontend open (in the browser), watch the bell icon **immediately** after running the curl command.
2. Verify the unread count badge increments by 1 without a page refresh (WebSocket push).
3. Click the bell → verify the new notification appears at the top of the list.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.5 Mark all read

1. With multiple unread notifications in the dropdown, click **"Mark all read"**.
2. Verify the unread count badge disappears (or shows 0) on the bell icon.
3. Verify all notification items lose their unread highlight / "Mark read" buttons.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.6 Notifications REST API

```bash
# List notifications (protected)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/notifications
# Expected: 401

curl -s "http://localhost:3001/api/notifications?limit=5" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
# Expected: 200 + { data: [], meta: { total, page, ... } }

# Unread count
curl -s http://localhost:3001/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
# Expected: { "count": N }

# Mark all read
curl -s -X PATCH http://localhost:3001/api/notifications/read-all \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
# Expected: { "updated": N }
```

| Test | Expected | Actual |
|------|----------|--------|
| GET /notifications without token | 401 | ___ |
| GET /notifications with token | 200 + paginated response | ___ |
| GET /notifications/unread-count | 200 + `{ count: N }` | ___ |
| PATCH /notifications/read-all | 200 + `{ updated: N }` | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 11.7 WebSocket "notifications-read-all" event

1. Have two browser tabs open on the same account (both logged in).
2. In **Tab 1**: click the bell → verify unread count.
3. In **Tab 2**: click **"Mark all read"** in the bell dropdown.
4. Switch back to **Tab 1**: verify the unread badge disappears without a page reload (WebSocket broadcast).

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 12 — Testing Infrastructure (Task 18 — P15)

### 12.1 Backend unit tests

```bash
cd backend
npm test
```

Expected output:

```
Test Suites: 3 passed, 3 total
Tests:       31 passed, 31 total
```

Verify all 31 tests pass with no failures or skips.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 12.2 Backend test coverage

```bash
cd backend
npm run test:cov
```

Verify the command completes without errors and outputs a coverage table. Note the coverage percentages for reference.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 12.3 Frontend tests

```bash
cd frontend
CI=true npx react-scripts test --watchAll=false
```

Expected output:

```
Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
```

Verify all 28 tests pass. Any `act()` warnings from Reactstrap dropdowns are cosmetic and do not count as failures.

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 12.4 Slice test details

```bash
cd frontend
CI=true npx react-scripts test --watchAll=false --testPathPattern="notificationsSlice"
```

Verify **17 tests** pass covering:

- Initial state shape
- `notificationReceived` — prepend, increment unreadCount, increment meta.total
- `allNotificationsCleared` — resets unreadCount, leaves items intact
- `fetchNotifications` — pending/fulfilled/rejected states
- `fetchUnreadCount` — fulfilled sets count
- `markNotificationRead` — replaces item in list, decrements count, floor at 0
- `markAllNotificationsRead` — sets readAt on all, resets count
- All 4 selectors

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 12.5 Navbar component test details

```bash
cd frontend
CI=true npx react-scripts test --watchAll=false --testPathPattern="AdminNavbar"
```

Verify **11 tests** pass covering:

- Renders without crashing
- Shows user display name
- No badge when unreadCount = 0
- Badge shows correct count
- Badge caps at "99+"
- "No notifications" empty state
- Notification titles render
- "Mark all read" appears only when unread > 0
- Per-item "Mark read" only for unread items
- "View all notifications" link always present

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 13 — Regression Checklist

Run these checks after all above sections pass to verify nothing pre-existing was broken.

### 13.1 Authentication flows

| Test | Expected | Actual |
|------|----------|--------|
| Login with correct credentials | Redirected to Dashboard | ___ |
| Login with wrong password | Error message shown | ___ |
| Register new user | Redirected to Dashboard | ___ |
| Protected route without login | Redirected to login page | ___ |
| Logout | Redirected to login, token cleared | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.2 Dashboard

| Test | Expected | Actual |
|------|----------|--------|
| Dashboard loads | 4 KPI cards with real numbers | ___ |
| Station overview panel | Shows seeded stations with status badges | ___ |
| Active alerts feed | Shows real alerts from DB | ___ |
| Real-time sensor update | Value updates without page reload (via MQTT/WebSocket) | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.3 Stations CRUD

| Test | Expected | Actual |
|------|----------|--------|
| Station list loads | Seeded stations visible | ___ |
| Create station (admin) | New station appears in list | ___ |
| Edit station (admin) | Changes saved, row updates | ___ |
| Delete station (admin) | Station removed with confirmation modal | ___ |
| Create station (analyst) | Button hidden | ___ |
| View station details | StationDetailsPage loads | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.4 Monitoring / Sensors

| Test | Expected | Actual |
|------|----------|--------|
| Sensor list loads | Seeded sensors visible | ___ |
| New Sensor button (admin) | Opens "Create Sensor" modal | ___ |
| View button (analyst) | Navigates to SensorDetailsPage | ___ |
| Edit button (operator) | Opens "Edit Sensor" modal (no Delete) | ___ |
| Delete button (admin) | Confirmation modal, then removed | ___ |
| Sensor history chart | Line chart renders | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.5 Alerts

| Test | Expected | Actual |
|------|----------|--------|
| Alerts page loads | Alert list with severity/status badges | ___ |
| Acknowledge alert (admin) | Status changes to `acknowledged` | ___ |
| Resolve alert (admin) | Status changes to `resolved` | ___ |
| New alert via API | Appears in list in real-time | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.6 Maintenance

| Test | Expected | Actual |
|------|----------|--------|
| Maintenance list loads | Seeded work orders visible | ___ |
| Create work order (admin) | New item appears in list | ___ |
| Edit work order (admin) | Modal pre-filled, changes saved | ___ |
| Delete work order (admin) | Removed after confirmation | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.7 Automation Builder

| Test | Expected | Actual |
|------|----------|--------|
| Builder page loads | Canvas and block panel visible | ___ |
| Drag generic block (Input) | Node appears on canvas | ___ |
| Drag industrial block (Sensor Read) | Blue node with correct ports | ___ |
| Save workflow | Persisted (can reload from DB) | ___ |

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.8 Frontend build (production)

```bash
cd frontend
npm run build
echo "Exit: $?"
# Expected: Exit 0, "The build folder is ready to be deployed."
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

### 13.9 Backend TypeScript check

```bash
cd backend
npx tsc --noEmit
echo "Exit: $?"
# Expected: Exit 0 — no TypeScript errors
```

[ ] PASSED &nbsp;&nbsp; [ ] FAILED &nbsp;&nbsp; Notes: _______________

---

## Section 14 — Troubleshooting

### T1 — Backend fails to start: `Cannot connect to database`

- Verify PostgreSQL container is running: `docker compose ps`
- Check the `backend/.env` or `.env.local` for `DATABASE_HOST=localhost`, `DATABASE_PORT=5432`, `DATABASE_USER=postgres`, `DATABASE_PASSWORD=postgres`, `DATABASE_NAME=aquaflow`
- Try: `docker compose up -d postgres && sleep 5 && cd backend && npm run start:dev`

---

### T2 — 401 on all API calls even with a valid token

- Token may have expired (1-hour TTL). Re-login and copy the fresh `access_token`.
- Verify the `Authorization` header is formatted as `Bearer <token>` (with a space).
- If the refresh token was used after logout, it is denylisted — login fresh.

---

### T3 — Bell icon shows 0 after creating a critical alert

- Confirm the frontend WebSocket is connected: open browser DevTools → Network → WS — look for a Socket.IO connection to `localhost:3001`.
- If no WS connection: check `REACT_APP_WS_URL` in `frontend/.env` is `http://localhost:3001`.
- The `notification-created` event is only dispatched if the alert was created via `POST /api/alerts`; MQTT threshold alerts also trigger it via `IotService`.

---

### T4 — Sensor history chart shows "No historical readings available"

- The sensor needs `SensorData` records. Publish an MQTT test message:
  ```bash
  mosquitto_pub -h localhost -p 1883 \
    -t "sensors/DEVICE_ID/data" \
    -m '{"value": 5.5, "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
  ```
  Replace `DEVICE_ID` with the sensor's `deviceId` field (visible in the Edit modal).
- Then reload the SensorDetailsPage.

---

### T5 — Docker build fails for frontend: `npm ci` error

- The frontend has peer dependency conflicts. The `Dockerfile` uses `--legacy-peer-deps`. Verify the Dockerfile line reads:
  `RUN npm ci --legacy-peer-deps`
- Rebuild: `docker compose build --no-cache frontend`

---

### T6 — Backend tests fail: `Cannot find module`

```bash
cd backend
npm install --legacy-peer-deps
npm test
```

If `@types/jest` or `ts-jest` is missing: `npm install --save-dev jest ts-jest @types/jest --legacy-peer-deps`

---

### T7 — Frontend tests fail: `Cannot find module '@testing-library/dom'`

```bash
cd frontend
npm install --save-dev @testing-library/dom --legacy-peer-deps
CI=true npx react-scripts test --watchAll=false
```

---

### T8 — Swagger UI blank or shows "Failed to load API definition"

- Confirm the backend is running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/auth/login`
- The Swagger UI is served at `/api/docs` (not `/docs`). Navigate to `http://localhost:3001/api/docs`.
- If the backend uses a different port, check `PORT` in `backend/.env`.

---

### T9 — Analytics charts show "No data available" for all sensors

- No `SensorData` records in the database. Publish MQTT test data (see T4) or use the seed script with `npm run seed` (if it includes sensor data generation).
- Check the time range: the default is last 24 hours. If data was created more than 24 hours ago, switch to the **7 d** or **30 d** preset.

---

### T10 — Redis cache test: both calls take the same time

- The in-memory cache fallback is active (Redis is not required). Both the cache miss and cache hit are fast for small datasets. This is expected behaviour — the test confirms 200 is returned both times and data is consistent.
- To use real Redis: add `REDIS_HOST=localhost` to `backend/.env` and restart the backend.

---

*End of MANUAL_TEST_GUIDE_V2.md*
