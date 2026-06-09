# AquaFlow — Industrial Blocks Complete Guide

> **Scope:** This document covers every industrial block available in the AquaFlow
> Workflow Builder, including the 5 core blocks, 6 extended blocks, and the
> Custom Calc block.  
> For each block you will find: what it does, its input/output contract,
> all configurable properties, when to use it, and at least one end-to-end
> scenario combining multiple blocks into a realistic industrial workflow.

---

## Table of Contents

1. [Core Industrial Blocks](#1-core-industrial-blocks)
   - [sensor-read](#11-sensor-read)
   - [threshold-check](#12-threshold-check)
   - [alert-trigger](#13-alert-trigger)
   - [mqtt-publish](#14-mqtt-publish)
   - [pump-control](#15-pump-control)
   - [station-control](#16-station-control)
2. [Extended Industrial Blocks](#2-extended-industrial-blocks)
   - [value-transform](#21-value-transform)
   - [sensor-check](#22-sensor-check)
   - [data-aggregate](#23-data-aggregate)
   - [stream-filter](#24-stream-filter)
   - [data-output](#25-data-output)
3. [Custom Calculation Block](#3-custom-calculation-block)
   - [custom-calc](#31-custom-calc)
4. [Combined Scenarios](#4-combined-scenarios)
   - [Scenario A — Pressure surge detection & auto-shutoff](#scenario-a--pressure-surge-detection--auto-shutoff)
   - [Scenario B — Daily flow-rate report with anomaly log](#scenario-b--daily-flow-rate-report-with-anomaly-log)
   - [Scenario C — Chlorine dose calculation & MQTT command](#scenario-c--chlorine-dose-calculation--mqtt-command)
   - [Scenario D — Multi-sensor quality gate](#scenario-d--multi-sensor-quality-gate)
   - [Scenario E — Burst pipe early warning](#scenario-e--burst-pipe-early-warning)

---

## 1. Core Industrial Blocks

---

### 1.1 `sensor-read`

**What it does**  
Fetches historical or live data from one sensor stored in the database.
Depending on the chosen operation it returns either a single scalar or a
time-series array.

**When to use it**  
Use `sensor-read` as the *entry point* of any workflow that needs real sensor
data. It replaces a manual `input` block when the value must come from the
database rather than from a trigger payload.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `sensorId` | select | ✓ | Sensor to read |
| `operation` | select | ✓ | `latest` · `average` · `min` · `max` · `delta` |
| `periodMinutes` | number | only for average/min/max/delta | Look-back window in minutes |

**Conditional properties (showFor)**

- `periodMinutes` is only shown when operation is `average`, `min`, `max`, or `delta`.

**Output ports**

| Port | Content |
|---|---|
| `value` | The scalar result (latest reading, average, min, max, or delta) |
| `delta` | Rate of change (only meaningful when operation = `delta`) |
| `raw` | Full array `[{ timestamp, value }]` used by downstream aggregate blocks |

**Input**  
Accepts any upstream value (ignored — the block always queries the DB).

**Output example — operation: `latest`**
```json
{ "value": 3.24, "unit": "bar", "sensorId": "s-001", "timestamp": "2026-06-08T10:00:00Z" }
```

**Output example — operation: `average` (periodMinutes: 60)**
```json
{ "value": 3.18, "unit": "bar", "sensorId": "s-001", "period": 60 }
```

---

### 1.2 `threshold-check`

**What it does**  
Compares a numeric input against a fixed threshold and routes execution to
either the `above` or `below` output port.

**When to use it**  
Simple binary branching based on a sensor value. Ideal for "is the pressure too
high?" type of decisions before triggering an alert or actuator command.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `threshold` | number | ✓ | Comparison value |
| `operator` | select | ✓ | `>` · `>=` · `<` · `<=` · `==` |

**Input**  
Any object with a `value` field (typically the output of `sensor-read`).

**Output ports**

| Port | Condition |
|---|---|
| `above` | Condition is TRUE — passes the input object through |
| `below` | Condition is FALSE — passes the input object through |

---

### 1.3 `alert-trigger`

**What it does**  
Creates a persistent alert record in the database and optionally sends a
real-time notification via WebSocket to the dashboard.

**When to use it**  
Always at the *end* of an alarm branch. Do not use it for informational
logging — use `data-output` (operation: `log`) instead.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✓ | Alert headline |
| `message` | string | ✓ | Detail message (supports `{{value}}` interpolation) |
| `severity` | select | ✓ | `info` · `warning` · `critical` |
| `stationId` | select | | Station to attach the alert to |

**Input**  
Any object — its `value` field is used for `{{value}}` interpolation in
`message`.

**Output ports**

| Port | Content |
|---|---|
| `triggered` | Original input enriched with `alertId` |

---

### 1.4 `mqtt-publish`

**What it does**  
Publishes a message to a Mosquitto MQTT topic. Used to send commands to
field devices (PLCs, RTUs, actuators) that subscribe to the broker.

**When to use it**  
Whenever a workflow decision must reach a physical device in real time.
Typical uses: open/close a valve, set a pump speed, acknowledge a device alarm.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `topic` | string | ✓ | MQTT topic (e.g. `stations/s1/pump/cmd`) |
| `payload` | string | ✓ | Message payload — static text or JSON template |
| `qos` | select | | `0` · `1` · `2` (default `0`) |
| `retain` | boolean | | Whether broker retains last message |

**Input**  
Passed through unchanged.

**Output ports**

| Port | Content |
|---|---|
| `sent` | Original input + `{ topic, payload, publishedAt }` |

---

### 1.5 `pump-control`

**What it does**  
High-level helper that publishes a structured start/stop/speed command to
the pump's MQTT control topic. Wraps `mqtt-publish` with a fixed JSON schema
understood by AquaFlow field firmware.

**When to use it**  
Prefer `pump-control` over a raw `mqtt-publish` when controlling AquaFlow-
managed pumps, because it enforces the correct payload format and logs the
command in the audit trail.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `stationId` | select | ✓ | Station that owns the pump |
| `pumpId` | string | ✓ | Pump identifier |
| `command` | select | ✓ | `start` · `stop` · `set_speed` |
| `speed` | number | only for `set_speed` | Target speed 0–100 % |

**Input / Output**  
Same pass-through pattern as `mqtt-publish`.

---

### 1.6 `station-control`

**What it does**  
Changes the operational status of a monitoring station directly in the
database (via `StationsService`), setting it to `active`, `maintenance`, or
`offline`.

**When to use it**  
Use in maintenance scheduling workflows or after detecting a critical failure
that should isolate the station from live monitoring.

**Properties**

| Property | Type | Required | Description |
|---|---|---|---|
| `stationId` | select | ✓ | Target station |
| `targetStatus` | select | ✓ | `active` · `maintenance` · `offline` |
| `reason` | string | | Human-readable reason stored in the audit log |

**Output ports**

| Port | Content |
|---|---|
| `done` | `{ stationId, previousStatus, newStatus, changedAt }` |

---

## 2. Extended Industrial Blocks

---

### 2.1 `value-transform`

**What it does**  
Applies a mathematical transformation to a numeric `value` from upstream.
Five operations cover the most common engineering unit conversions and
data-quality tasks.

**When to use it**  
Insert between `sensor-read` and any decision or output block whenever the
raw sensor value needs to be converted (e.g. mA → bar), clamped to a
valid range, or normalized.

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `operation` | select | always | `scale` · `clamp` · `round` · `abs` · `formula` |
| `factor` | number | `scale` | Multiplier |
| `offset` | number | `scale` | Added after multiplication: `result = value × factor + offset` |
| `min` | number | `clamp` | Lower bound |
| `max` | number | `clamp` | Upper bound |
| `decimals` | number | `round` | Number of decimal places |
| `expression` | string | `formula` | mathjs expression — use `x` for the input value |

**Input**  
Object with a `value` field (number).

**Output ports**

| Port | Content |
|---|---|
| `result` | `{ value: <transformed>, original: <raw> }` |

**Examples**

- `scale` — convert 4–20 mA current to 0–10 bar: `factor = 0.625`, `offset = -2.5`
- `formula` — convert Celsius to Fahrenheit: `expression = "x * 9/5 + 32"`
- `clamp` — guard a pH value to 0–14: `min = 0`, `max = 14`

---

### 2.2 `sensor-check`

**What it does**  
Evaluates a condition on one or two sensor values and routes execution to
`pass` or `fail`. Unlike `threshold-check` (which is hard-wired to one
operator), `sensor-check` supports six operations including sensor-vs-sensor
comparison.

**When to use it**  
Use when you need a richer condition than a simple threshold: range check,
equality test, or comparing two live sensor values against each other.

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `operation` | select | always | `above` · `below` · `between` · `outside` · `equals` · `compare` |
| `threshold` | number | `above` · `below` · `equals` | Reference value |
| `min` | number | `between` · `outside` | Lower bound |
| `max` | number | `between` · `outside` | Upper bound |
| `tolerance` | number | `equals` | Accepted ± deviation for equality |
| `sensorIdA` | select | `compare` | First sensor |
| `sensorIdB` | select | `compare` | Second sensor (compared to A) |
| `compareOp` | select | `compare` | `>` · `<` · `>=` · `<=` · `==` |

**Input ports**

| Port | Used for |
|---|---|
| `value` | Default input — scalar or object with `value` field |
| `valueA` | First operand when operation = `compare` |
| `valueB` | Second operand when operation = `compare` |

**Output ports**

| Port | Condition |
|---|---|
| `pass` | Condition is TRUE |
| `fail` | Condition is FALSE |

---

### 2.3 `data-aggregate`

**What it does**  
Consumes a time series (the `raw` port array from `sensor-read`) and reduces
it to a single aggregated metric. Five operations cover the main statistical
and process-monitoring needs.

**When to use it**  
Use after a `sensor-read` with operation `average`/`min`/`max` when you need
a more sophisticated reduction: rolling window, event counting, rate of
change, or percentile.

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `operation` | select | always | `time_average` · `rolling_average` · `event_counter` · `rate_of_change` · `percentile` |
| `windowMinutes` | number | `time_average` · `rolling_average` | Time window in minutes |
| `windowSeconds` | number | `event_counter` | Counting window in seconds |
| `threshold` | number | `event_counter` | Value threshold that counts as an event |
| `percentile` | number | `percentile` | 0–100 |
| `sensorId` | select | always | Sensor to aggregate (queries DB directly) |

**Input**  
Can accept the `raw` array from `sensor-read` or query the DB itself.

**Output ports**

| Port | Content |
|---|---|
| `result` | `{ value: <aggregated>, operation, sensorId, computedAt }` |

---

### 2.4 `stream-filter`

**What it does**  
Pre-processes a raw sensor time series by removing noise, rejecting spikes,
smoothing, or detecting burst events before the data reaches a decision block.

**When to use it**  
Use between `sensor-read` and any decision or output block when the raw
signal is noisy (vibration sensors, flow meters with hydraulic shocks).

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `operation` | select | always | `deadband` · `spike_reject` · `moving_average` · `burst_detect` |
| `deadbandValue` | number | `deadband` | Minimum change to pass through (eliminates micro-fluctuations) |
| `spikeThreshold` | number | `spike_reject` | Z-score threshold — readings beyond this are rejected |
| `windowSize` | number | `moving_average` | Number of samples in the moving average window |
| `burstWindowMs` | number | `burst_detect` | Time window (ms) for counting rapid readings — triggers if count > threshold |
| `burstThreshold` | number | `burst_detect` | Number of events within `burstWindowMs` that signals a burst |

**Input**  
Object with a `value` field or `raw` array from `sensor-read`.

**Output ports**

| Port | Content |
|---|---|
| `filtered` | Cleaned value or smoothed array |
| `rejected` | Values removed by spike_reject or burst_detect |

---

### 2.5 `data-output`

**What it does**  
Writes processed data to a persistent destination: the AquaFlow log, the
`sensor_data` time-series table, a CSV export, or an external webhook.

**When to use it**  
Always at the *end* of an analysis branch when you want to record the result
for auditing, reporting, or integration with a third-party system.

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `operation` | select | always | `log` · `store` · `export_csv` · `webhook` |
| `label` | string | `log` | Human-readable label for the log entry |
| `tags` | string | `log` | JSON array of string tags: `["pressure","station-1"]` |
| `sensorId` | select | `store` | Sensor whose historical table receives the new row |
| `filename` | string | `export_csv` | CSV filename (saved to MinIO data lake) |
| `webhookUrl` | string | `webhook` | Destination URL (POST with JSON body) |
| `headers` | string | `webhook` | JSON object of custom HTTP headers |

**Input**  
Any object — stored as `payload` in the log / webhook body.

**Output ports**

| Port | Content |
|---|---|
| `done` | Original input + `{ outputOperation, writtenAt }` |

---

## 3. Custom Calculation Block

---

### 3.1 `custom-calc`

**What it does**  
Fetches up to four independent sensor time series from the database, aligns
them onto a common time grid, evaluates a user-defined mathjs formula over
the aligned values, and returns an aggregated scalar result.

This block replaces complex chains of `sensor-read` + `value-transform` +
`action` when the calculation involves multiple sensors and time ranges.

**When to use it**  
- Water quality index combining turbidity, pH, and chlorine readings
- Differential pressure between two measurement points
- Energy efficiency ratio: flow / power consumption
- Any multi-variable formula that cannot be expressed with a single `value-transform`

**Properties**

| Property | Type | Shown for | Description |
|---|---|---|---|
| `formula` | string | always | mathjs expression using `a`, `b`, `c`, `d` as variable names |
| `sensorIdA` | select | always | Sensor mapped to variable `a` |
| `sensorIdB` | select | | Sensor mapped to variable `b` |
| `sensorIdC` | select | | Sensor mapped to variable `c` |
| `sensorIdD` | select | | Sensor mapped to variable `d` |
| `timeMode` | select | always | `last_n_minutes` · `absolute` |
| `periodMinutes` | number | `last_n_minutes` | Look-back window in minutes |
| `startDate` | datetime-local | `absolute` | Start of the time range |
| `endDate` | datetime-local | `absolute` | End of the time range |
| `resampleStrategy` | select | always | `interpolate` · `forward_fill` · `downsample` |
| `downsampleAgg` | select | `downsample` | `mean` · `min` · `max` · `sum` |
| `aggregation` | select | always | `mean` · `min` · `max` · `sum` · `last` |

**Time-series alignment strategies**

| Strategy | Behaviour |
|---|---|
| `interpolate` | Linearly interpolates each series to a common 1-minute grid |
| `forward_fill` | Carries the last known value forward to fill gaps |
| `downsample` | Groups readings into 1-minute buckets and applies `downsampleAgg` |

**Input**  
Accepts any upstream value (ignored — block queries the DB directly).

**Output ports**

| Port | Content |
|---|---|
| `result` | `{ value: <scalar>, formula, variables: { a, b, c, d }, aggregation, computedAt }` |

**Formula examples**

```
a - b                          # differential pressure (sensor A minus sensor B)
(a + b + c) / 3                # simple average of three sensors
(a / b) * 100                  # ratio as a percentage
sqrt(a^2 + b^2)                # Euclidean combination
clamp(a * 0.0625 - 2.5, 0, 10) # 4-20mA to 0-10 bar, clamped
```

> **Security:** formulas are evaluated with mathjs `evaluate()` — `eval()` is
> never used and JavaScript code cannot be injected.

---

## 4. Combined Scenarios

---

### Scenario A — Pressure surge detection & auto-shutoff

**Goal:** Read the outlet pressure of pump station P-01 every 5 minutes.
If the 5-minute average exceeds 8.5 bar, stop the pump and create a critical alert.

**Blocks used:** `sensor-read` → `threshold-check` → (above branch) `pump-control` + `alert-trigger`

```
[sensor-read]
  sensorId: "pressure-outlet-p01"
  operation: average
  periodMinutes: 5
        |
        | value
        ▼
[threshold-check]
  threshold: 8.5
  operator: >
        |           |
      above        below
        |             \——— (do nothing / log normal)
        ▼
  ┌─────────────────┐
  │  [pump-control] │         [alert-trigger]
  │  station: P-01  │──done──▶ title: "Pressure Surge"
  │  command: stop  │          message: "Avg pressure {{value}} bar exceeded 8.5 bar"
  └─────────────────┘          severity: critical
```

**Interpretation:**  
- `sensor-read` queries the last 5 minutes of readings and averages them.
- `threshold-check` branches on `> 8.5`.
- The `above` branch fires both `pump-control` (stops the pump via MQTT) and
  `alert-trigger` (creates a critical alert visible on the dashboard).

---

### Scenario B — Daily flow-rate report with anomaly log

**Goal:** Every day at 06:00, compute the 24-hour average flow rate. If it
deviates more than 20 % from the rolling 7-day average, log an anomaly with tags.

**Blocks used:** `sensor-read` (today) → `data-aggregate` (7-day rolling) →
`sensor-check` (compare) → `data-output` (log)

```
[sensor-read]                      [data-aggregate]
  sensorId: "flow-main"              sensorId: "flow-main"
  operation: average                 operation: rolling_average
  periodMinutes: 1440                windowMinutes: 10080 (7 days)
        |                                   |
        | value                             | result
        ▼                                   ▼
               [sensor-check]
                 operation: compare
                 compareOp: >
                 (valueA=today avg, valueB=7-day avg × 1.2)
                        |              |
                      pass            fail
                        |
                        ▼
                  [data-output]
                    operation: log
                    label: "Flow anomaly detected"
                    tags: ["flow","anomaly","daily-report"]
```

---

### Scenario C — Chlorine dose calculation & MQTT command

**Goal:** Compute the required chlorine dose based on flow rate and current
chlorine residual, then publish the setpoint to the dosing pump controller.

**Formula:** `dose = (0.5 - b) * a * 0.001`
- `a` = flow rate in m³/h
- `b` = chlorine residual in mg/L
- target residual = 0.5 mg/L, conversion factor = 0.001

**Blocks used:** `custom-calc` → `value-transform` (clamp) → `mqtt-publish`

```
[custom-calc]
  formula: "(0.5 - b) * a * 0.001"
  sensorIdA: "flow-rate-main"       ← a
  sensorIdB: "chlorine-residual"    ← b
  timeMode: last_n_minutes
  periodMinutes: 10
  resampleStrategy: interpolate
  aggregation: mean
        |
        | result
        ▼
[value-transform]
  operation: clamp
  min: 0          ← never inject negative dose
  max: 5          ← safety cap in kg/h
        |
        | result
        ▼
[mqtt-publish]
  topic: "stations/water-plant/dosing/setpoint"
  payload: '{"dose_kg_h": {{value}}, "source": "aquaflow-workflow"}'
  qos: 1
  retain: true
```

**Interpretation:**  
The `custom-calc` block fetches the last 10 minutes of flow and chlorine
readings, aligns them, and evaluates the dose formula. `value-transform`
clamps the result to a safe range before the MQTT command is sent.

---

### Scenario D — Multi-sensor water quality gate

**Goal:** Before releasing treated water to the distribution network, verify
that pH is between 6.5 and 8.5 AND turbidity is below 1 NTU.
If both conditions pass, open the outlet valve. If either fails, trigger an alert.

**Blocks used:** `sensor-read` ×2 → `sensor-check` ×2 → (gate logic via
`action`) → `pump-control` / `alert-trigger`

```
[sensor-read: pH]           [sensor-read: turbidity]
  operation: latest           operation: latest
       |                            |
       | value                      | value
       ▼                            ▼
[sensor-check: pH range]    [sensor-check: turbidity]
  operation: between            operation: below
  min: 6.5, max: 8.5            threshold: 1.0
       |      |                       |      |
     pass   fail                    pass   fail
       |                             |
       └──────────┬──────────────────┘
                  ▼
            [action: AND gate]
              expression: "input.pH_ok && input.turb_ok"
                  |             |
                pass           fail
                  |              \——→ [alert-trigger] Quality gate FAILED
                  ▼
         [pump-control]
           command: start  (open outlet valve)
```

> **Note:** the `action` block implements the logical AND by checking both
> upstream results stored in context variables.

---

### Scenario E — Burst pipe early warning

**Goal:** Monitor a flow sensor for sudden high-frequency spikes that indicate
a pipe burst, then send a WhatsApp-style webhook notification and set the
station to maintenance mode.

**Blocks used:** `sensor-read` → `stream-filter` (burst_detect) →
`data-output` (webhook) → `station-control`

```
[sensor-read]
  sensorId: "flow-distribution-north"
  operation: latest
        |
        | value
        ▼
[stream-filter]
  operation: burst_detect
  burstWindowMs: 5000      ← 5-second window
  burstThreshold: 8        ← 8 or more spikes in 5 s = burst
        |            |
    filtered       rejected (burst detected)
                     |
                     ▼
             [data-output]
               operation: webhook
               webhookUrl: "https://hooks.example.com/pipe-alert"
               headers: '{"Authorization":"Bearer <token>"}'
                     |
                   done
                     ▼
             [station-control]
               stationId: "north-district"
               targetStatus: maintenance
               reason: "Burst pipe detected by workflow"
```

**Interpretation:**  
When `stream-filter` detects a burst pattern, it routes output to the
`rejected` port. The webhook posts a JSON payload to an external notification
service (could be a Zapier hook, a Teams channel, or an SMS gateway).
`station-control` then immediately isolates the station from live monitoring
to prevent false readings from corrupting dashboards.

---

## Quick-Reference Table

| Block | Category | Main Use | Key Output Port |
|---|---|---|---|
| `sensor-read` | Core | Fetch live/historical sensor data | `value`, `raw` |
| `threshold-check` | Core | Binary branch on a value | `above`, `below` |
| `alert-trigger` | Core | Create DB alert + real-time notification | `triggered` |
| `mqtt-publish` | Core | Send raw MQTT command | `sent` |
| `pump-control` | Core | Start/stop/speed AquaFlow pump | `done` |
| `station-control` | Core | Change station operational status | `done` |
| `value-transform` | Extended | Convert / clamp / normalize a value | `result` |
| `sensor-check` | Extended | Multi-mode condition with two ports | `pass`, `fail` |
| `data-aggregate` | Extended | Statistical reduction of a time series | `result` |
| `stream-filter` | Extended | Noise removal / burst detection | `filtered`, `rejected` |
| `data-output` | Extended | Persist / export / webhook | `done` |
| `custom-calc` | Custom | Multi-sensor formula (mathjs) | `result` |

---

*Document generated 2026-06-08 — AquaFlow PFE Project*
