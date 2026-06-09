# AquaFlow — General Blocks Complete Guide

> **Scope:** This document covers every non-industrial block available in the
> AquaFlow Workflow Builder: Data, Logic, Timing, Messaging, and Integration
> categories.  
> For each block you will find: what it does, its input/output contract, all
> configurable properties, when to use it, and combined scenarios that chain
> multiple blocks into realistic workflows.

---

## Table of Contents

1. [Data Blocks](#1-data-blocks)
   - [input](#11-input)
   - [output](#12-output)
   - [data-transform](#13-data-transform)
2. [Logic Blocks](#2-logic-blocks)
   - [action](#21-action)
   - [decision](#22-decision)
3. [Timing Blocks](#3-timing-blocks)
   - [delay](#31-delay)
4. [Messaging Blocks](#4-messaging-blocks)
   - [notification](#41-notification)
5. [Integration Blocks](#5-integration-blocks)
   - [http-request](#51-http-request)
6. [Combined Scenarios](#6-combined-scenarios)
   - [Scenario A — Input validation pipeline](#scenario-a--input-validation-pipeline)
   - [Scenario B — API data enrichment & notification](#scenario-b--api-data-enrichment--notification)
   - [Scenario C — Multi-step transformation chain](#scenario-c--multi-step-transformation-chain)
   - [Scenario D — Scheduled report with external POST](#scenario-d--scheduled-report-with-external-post)
   - [Scenario E — Decision tree with delay & fallback notification](#scenario-e--decision-tree-with-delay--fallback-notification)
7. [Quick-Reference Table](#quick-reference-table)

---

## 1. Data Blocks

Data blocks handle the entry and exit of data in a workflow, and provide
field-level manipulation of JSON payloads.

---

### 1.1 `input`

**What it does**  
Marks the *start node* of a workflow. It injects a static value or a
trigger payload into the execution graph. Every workflow must have at least
one `input` block.

**When to use it**  
- Manual trigger workflows where you test with a known value.
- As a placeholder for a trigger payload (MQTT message, schedule event,
  or API call) — the runtime replaces the static value with the live payload
  at execution time.
- Rapid prototyping and testing of downstream logic before connecting real
  sensors.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name on the canvas |
| `value` | text | Default injected value (number, JSON string, or plain text) |

**Input ports**  
None — this is always the first node.

**Output ports**

| Port | Content |
|---|---|
| `Data` | The `value` property (or live trigger payload at runtime) |

**Output example**
```json
"42"
```
or, when used with a schedule trigger:
```json
{ "triggeredAt": "2026-06-08T06:00:00Z", "source": "scheduler" }
```

> **Tip:** Set `value` to a realistic JSON string during development so you
> can run the workflow manually and verify all downstream blocks without
> waiting for a real event.

---

### 1.2 `output`

**What it does**  
Marks the *terminal node* of a workflow branch. It receives the final value
from upstream and records the execution result. A workflow can have multiple
`output` blocks (one per terminal branch).

**When to use it**  
Always at the end of every branch. Without an `output` block, the execution
engine still runs but the result is not persisted — you lose traceability in
the execution history panel.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name on the canvas |
| `format` | select | How the result is serialized: `json` · `text` · `number` |

**Input ports**

| Port | Accepts |
|---|---|
| `Result` | Any upstream value |

**Output ports**  
None — terminal node.

**Formats explained**

| Format | Behaviour |
|---|---|
| `json` | Stores the value as-is (objects, arrays, primitives all supported) |
| `text` | Coerces to string — useful for readable log entries |
| `number` | Parses to float — useful for numeric KPI recording |

---

### 1.3 `data-transform`

**What it does**  
Performs field-level surgery on the incoming JSON payload: extract a single
field, set or delete a field, or convert the payload between JSON and string
representations.

**When to use it**  
- After `http-request` when the API response contains nested fields and you
  only need one (`extract_field`).
- Before `notification` when you want to attach extra context to the payload
  (`set_field`).
- When an upstream block returns a JSON string that must be parsed into an
  object before the next block can read its properties (`parse_json`).
- When a downstream webhook expects a plain string body (`stringify_json`).

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `operation` | select | See table below |
| `field` | text | Field name to act on (dot notation supported: `data.value`) |
| `value` | text | New value — only for `set_field` |

**Operations**

| Operation | What it does |
|---|---|
| `extract_field` | Returns only `input[field]` — discards the rest of the object |
| `set_field` | Adds/overwrites `input[field] = value` and passes the full object |
| `delete_field` | Removes `field` from the object and passes the rest |
| `to_number` | Casts the entire input (or `input[field]` if set) to a float |
| `to_string` | Casts to string |
| `parse_json` | `JSON.parse(input)` — converts a JSON string to an object |
| `stringify_json` | `JSON.stringify(input)` — converts an object to a JSON string |

**Input ports**

| Port | Accepts |
|---|---|
| `In` | Any value (object, string, number) |

**Output ports**

| Port | Content |
|---|---|
| `Transformed` | Result of the operation |
| `Error` | Fired when the operation fails (e.g. malformed JSON on `parse_json`) |

**Output example — `extract_field`, field: `"temperature"`**
```json
// Input:  { "temperature": 22.4, "humidity": 60, "unit": "C" }
// Output: 22.4
```

---

## 2. Logic Blocks

Logic blocks make decisions and transform values without touching the
database or external services.

---

### 2.1 `action`

**What it does**  
Applies a simple arithmetic or string operation to the incoming value.
It is the general-purpose transformation block for cases that do not need
the full power of `value-transform` (which is designed for physical sensor
units) or `data-transform` (which operates on JSON fields).

**When to use it**  
- Quick math: multiply a sensor reading by a calibration factor before
  a decision block.
- String manipulation: uppercase a status label before a notification.
- Append context: add a suffix to a string value for logging.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `operation` | select | `multiply` · `add` · `subtract` · `divide` · `uppercase` · `append` |
| `factor` | number | Operand for `multiply` / `add` / `subtract` / `divide` |
| `text` | text | String to append — only for `append` |

**Operations**

| Operation | Formula | Input type |
|---|---|---|
| `multiply` | `output = input × factor` | number |
| `add` | `output = input + factor` | number |
| `subtract` | `output = input − factor` | number |
| `divide` | `output = input / factor` | number |
| `uppercase` | `output = input.toUpperCase()` | string |
| `append` | `output = input + text` | string |

**Input / Output ports**

| Port | Content |
|---|---|
| `In` | Input value |
| `Out` | Transformed value |

---

### 2.2 `decision`

**What it does**  
Compares the incoming numeric value against a fixed threshold using a
configurable operator and routes execution to one of two output ports.
It is the primary branching block for numeric conditions.

**When to use it**  
Wherever you need a binary branch based on a number:
- Is flow rate above the minimum required?
- Is pH within the acceptable range?
- Did the count exceed the alert limit?

Use `decision` for simple single-threshold comparisons. Use `sensor-check`
(industrial) when you need multi-level thresholds, rate-of-change, or
sensor-vs-sensor comparison.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `operator` | select | `>` · `>=` · `<` · `<=` · `==` · `!=` |
| `compareTo` | number | The right-hand side of the comparison |

**Input ports**

| Port | Accepts |
|---|---|
| `In` | A number, or an object with a `value` field |

**Output ports**

| Port | Fires when |
|---|---|
| `True` | The condition evaluates to `true` |
| `False` | The condition evaluates to `false` |

**Example**

```
input = 72  |  operator = ">"  |  compareTo = 70
→ routes to "True" port
```

---

## 3. Timing Blocks

---

### 3.1 `delay`

**What it does**  
Pauses the workflow execution for a configurable number of milliseconds
before passing the input value unchanged to the next block.

**When to use it**  
- Add a cooldown between an actuator command and a follow-up sensor read
  (e.g. wait 2 seconds for a pump to reach operating speed before reading
  the outlet pressure).
- Rate-limit rapid trigger-chain workflows to prevent API flooding.
- Simulate time-based logic in testing.

> **Safety cap:** The engine enforces a maximum delay of **30 000 ms (30 s)**
> regardless of the configured value, to prevent workflows from blocking
> indefinitely.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `durationMs` | number | Wait time in milliseconds (max 30 000) |

**Input / Output ports**

| Port | Content |
|---|---|
| `In` | Input value |
| `Out` | Same value, passed through after the delay |

---

## 4. Messaging Blocks

---

### 4.1 `notification`

**What it does**  
Sends a human-readable notification via the configured channel:
- **`in_app`**: creates a persistent notification record in the AquaFlow
  database and pushes it to the dashboard in real time via WebSocket.
- **`webhook`**: HTTP POSTs a JSON body `{ subject, message, payload }` to
  any external URL (Slack, Teams, Zapier, SMS gateway, etc.).

**When to use it**  
Use `notification` when the audience is a human operator who reads the
AquaFlow dashboard or a mobile/desktop app that receives webhook pushes.
Use `alert-trigger` (industrial) instead when you need a persistent,
severity-classified alert that lives in the alert management module.

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `channel` | select | `in_app` · `webhook` |
| `webhookUrl` | text | Destination URL — only for `webhook` |
| `subject` | text | Notification subject line |
| `message` | text/textarea | Notification body (supports plain text) |

**Input ports**

| Port | Accepts |
|---|---|
| `In` | Any value — attached as `payload` in the webhook body |

**Output ports**

| Port | Content |
|---|---|
| `Sent` | Original input + `{ notificationId, sentAt }` |

**Webhook POST body**
```json
{
  "subject": "Flow alert",
  "message": "Flow rate exceeded threshold",
  "payload": { "value": 92.4, "unit": "m3/h" },
  "sentAt": "2026-06-08T10:05:00Z"
}
```

---

## 5. Integration Blocks

---

### 5.1 `http-request`

**What it does**  
Makes a synchronous outbound HTTP call to any REST endpoint. The full
response (status code + body) is forwarded to the `response` output port.
If the request fails (network error or 4xx/5xx), execution is routed to the
`error` port.

**When to use it**  
- Fetch reference data from an external API before a decision (e.g. get the
  current weather to adjust sensor thresholds seasonally).
- Push workflow results to a third-party platform (BI tool, CMMS, ERP).
- Trigger a remote action (open a ticket in Jira, post a Slack message,
  call a government water-quality reporting API).

**Properties**

| Property | Type | Description |
|---|---|---|
| `label` | text | Display name |
| `method` | select | `GET` · `POST` · `PUT` · `PATCH` · `DELETE` |
| `url` | text | Full URL including query string if needed |
| `headers` | textarea | JSON object of request headers (e.g. `{"Authorization":"Bearer <token>"}`) |
| `body` | textarea | Static JSON body — merged with upstream input for POST/PUT/PATCH |

**Input ports**

| Port | Accepts |
|---|---|
| `Body` | Object merged into the request body (overrides `body` property fields) |

**Output ports**

| Port | Content |
|---|---|
| `Response` | `{ status: 200, data: <parsed body> }` |
| `Error` | `{ status: 500, message: "..." }` on network failure or HTTP error |

**Header examples**

```json
{ "Authorization": "Bearer eyJ...", "Content-Type": "application/json" }
{ "X-API-Key": "abc123", "Accept": "application/json" }
```

---

## 6. Combined Scenarios

---

### Scenario A — Input validation pipeline

**Goal:** Accept a numeric payload from a manual trigger. Validate that it is
within 0–100. If valid, multiply it by a calibration factor and record the
result. If invalid, send an in-app notification.

**Blocks used:**  
`input` → `decision` → (True) `action` → `output`  
                   → (False) `notification` → `output`

```
[input]
  value: "75"
       |
       | Data
       ▼
[decision]
  operator: >=
  compareTo: 0
       |           |
     True         False
       |             |
       ▼             ▼
[decision #2]   [notification]
  operator: <=    channel: in_app
  compareTo: 100  subject: "Invalid input"
       |           message: "Value out of 0-100 range"
     True
       |
       ▼
[action]
  operation: multiply
  factor: 1.023     ← calibration factor
       |
       ▼
[output]
  format: number
```

---

### Scenario B — API data enrichment & notification

**Goal:** Fetch the current water quality standard limit from an external API,
compare it with the incoming sensor value, and notify the operator if the
limit is exceeded.

**Blocks used:**  
`input` → `http-request` → `data-transform` → `decision` → `notification`

```
[input]
  value: '{"sensor_value": 8.7, "unit": "NTU"}'
       |
       ▼
[data-transform]
  operation: parse_json
       |
       ▼
[http-request]
  method: GET
  url: https://api.water-standards.gov/limits/turbidity
  headers: {"Accept":"application/json"}
       |              |
   Response          Error ─────────────────→ [notification]
       |                                        subject: "API unavailable"
       ▼
[data-transform]
  operation: extract_field
  field: limit          ← e.g. returns 5 (NTU limit)
       |
       ▼
[decision]
  operator: >
  compareTo: <limit value>
       |              |
     True            False
       |
       ▼
[notification]
  channel: in_app
  subject: "Turbidity exceeds standard"
  message: "Measured 8.7 NTU, limit is 5 NTU"
       |
       ▼
[output]
```

---

### Scenario C — Multi-step transformation chain

**Goal:** Take a raw 4–20 mA current signal (as a number), convert it to an
engineering value (0–10 bar), round to 2 decimals, append the unit label,
and store the result.

**Blocks used:**  
`input` → `action` (scale) → `action` (offset) → `action` (no-op for
rounding — use `data-transform to_number`) → `data-transform` (set_field) → `output`

```
[input]
  value: "14.4"   ← mA reading
       |
       ▼
[action]
  operation: multiply
  factor: 0.625   ← maps 4–20 mA range to 0–10 bar range width
       |
       ▼
[action]
  operation: subtract
  factor: 2.5     ← shift: 4 mA × 0.625 = 2.5 → 0 bar
       |
       ▼
[data-transform]
  operation: to_number   ← ensure we have a clean float
       |
       ▼
[data-transform]
  operation: set_field
  field: unit
  value: "bar"
       |
       ▼
[output]
  format: json
  ← result: { "value": 6.25, "unit": "bar" }
```

---

### Scenario D — Scheduled report with external POST

**Goal:** Every day at 08:00, build a structured payload and POST it to a
reporting API. If the POST fails, send a webhook notification to the on-call
channel.

**Blocks used:**  
`input` (schedule trigger) → `data-transform` (set_field ×2) → `http-request` → `notification` (on error)

```
[input]
  value: '{"date":"2026-06-08","source":"scheduler"}'
       |
       ▼
[data-transform]
  operation: set_field
  field: report_type
  value: "daily_summary"
       |
       ▼
[data-transform]
  operation: set_field
  field: station
  value: "north-district"
       |
       ▼
[http-request]
  method: POST
  url: https://bi.company.com/api/reports/ingest
  headers: {"Authorization":"Bearer <token>","Content-Type":"application/json"}
       |                |
    Response           Error
       |                  |
       ▼                  ▼
[output]           [notification]
  format: json       channel: webhook
                     webhookUrl: https://hooks.slack.com/...
                     subject: "Report POST failed"
                     message: "Daily report could not be delivered"
```

---

### Scenario E — Decision tree with delay & fallback notification

**Goal:** After sending a pump start command (handled upstream), wait 3 seconds
for the pump to spin up, then check if the outlet pressure confirms the pump
is running. If pressure is still too low after the delay, notify the operator.

**Blocks used:**  
`input` (pump started event) → `delay` → `decision` → (False) `notification` → `output`

```
[input]
  value: '{"pump":"P-01","command":"start","pressure":0.8}'
       |
       ▼
[delay]
  durationMs: 3000   ← wait 3 s for pump to reach operating pressure
       |
       ▼
[data-transform]
  operation: extract_field
  field: pressure
       |
       ▼
[decision]
  operator: >=
  compareTo: 2.5     ← minimum operating pressure (bar)
       |         |
     True       False
       |           |
       ▼           ▼
[output]    [notification]
  format:     channel: in_app
  json        subject: "Pump P-01 failed to start"
              message: "Pressure still 0.8 bar after 3 s — check the pump"
                  |
                  ▼
             [output]
               format: text
```

**Interpretation:**  
The 3-second `delay` gives the physical pump time to react. Without it, the
pressure read immediately after the start command would always be low, causing
a false alarm on every start. The delay absorbs the mechanical response time
before the `decision` block evaluates the actual running pressure.

---

## Quick-Reference Table

| Block | Category | Main Use | Key Output Port |
|---|---|---|---|
| `input` | Data | Inject a value / receive trigger payload | `Data` |
| `output` | Data | Record final result, end the branch | — (terminal) |
| `data-transform` | Data | Extract / set / delete fields, parse/stringify JSON | `Transformed`, `Error` |
| `action` | Logic | Arithmetic or string operation on a value | `Out` |
| `decision` | Logic | Binary branch on numeric comparison | `True`, `False` |
| `delay` | Timing | Pause execution for N milliseconds | `Out` |
| `notification` | Messaging | In-app notification or webhook push | `Sent` |
| `http-request` | Integration | Outbound REST call, response forwarded | `Response`, `Error` |

---

## Block Selection Guide

Use this decision tree to choose the right block:

```
Need to START a workflow?
  └─► input

Need to END a branch?
  └─► output

Need to BRANCH on a condition?
  ├─► Single numeric threshold          → decision
  ├─► Multi-level or rate-of-change    → sensor-check (industrial)
  └─► Sensor vs sensor                 → sensor-check (compare mode)

Need to TRANSFORM a value?
  ├─► Math on a scalar number           → action
  ├─► Physical unit conversion          → value-transform (industrial)
  ├─► JSON field manipulation           → data-transform
  └─► Multi-sensor formula              → custom-calc (industrial)

Need to WAIT?
  └─► delay

Need to NOTIFY a human?
  ├─► Dashboard notification            → notification (in_app)
  ├─► External service (Slack, SMS…)    → notification (webhook)
  └─► Persistent severity alert         → alert-trigger (industrial)

Need to call an EXTERNAL API?
  └─► http-request
```

---

*Document generated 2026-06-08 — AquaFlow PFE Project*
