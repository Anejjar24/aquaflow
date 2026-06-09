# AquaFlow — Workflow Builder: Complete Technical Reference

> This document contains everything needed to understand, discuss, or extend the Workflow Builder module of AquaFlow.
> Use it as context for any AI assistant conversation.

---

## 1. PROJECT OVERVIEW

**AquaFlow** is an industrial water station supervision platform (PFE capstone project).

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, TypeORM, TimescaleDB (PostgreSQL 15) |
| Frontend | React 18, Redux Toolkit, Reactstrap, JointJS |
| Real-time | Socket.IO 4 |
| IoT | MQTT via Eclipse Mosquitto 2 |
| Cache | Redis 7 |
| Auth | JWT + RBAC (admin · operator · technician · analyst) |
| Event streaming | Apache Kafka 3.6 (KRaft — no Zookeeper) |
| Data lake | MinIO (S3-compatible object storage) |
| Big data | Apache Spark 3.5 (PySpark — batch + structured streaming) |
| Charts | Chart.js **v2.9.4** + react-chartjs-2 **v2.11.2** |

---

## 2. WORKFLOW BUILDER — WHAT IT IS

The Workflow Builder is a **visual drag-and-drop automation editor** that allows operators to create, configure, and execute automated industrial processes. It consists of:

- A **visual canvas** (JointJS) where users drag and connect nodes
- A **client-side engine** that serializes/deserializes the graph
- A **backend execution engine** that runs workflows using BFS traversal
- **23 specialized handlers** that execute each node type
- **3 trigger mechanisms**: Manual, Scheduled (cron), Sensor Threshold (MQTT)

---

## 3. FILE STRUCTURE

```
frontend/src/
├── pages/
│   └── BuilderPage.jsx              ← Main UI page
├── hooks/
│   ├── useWorkflowEditor.js         ← Top-level editor state
│   └── useJointGraph.js             ← JointJS canvas management
├── engine/
│   ├── graphSerializer.js           ← JointJS → JSON
│   ├── graphDeserializer.js         ← JSON → JointJS
│   ├── autosaveManager.js           ← localStorage persistence
│   ├── executionHistoryManager.js   ← Execution history (50 max)
│   └── workflowExecutorClient.js    ← API call wrapper
├── registry/
│   ├── blockRegistry.js             ← In-memory block type map
│   └── blockFactory.js              ← JointJS node/link factory
└── data/
    └── blocks.js                    ← 23 block definitions (575 lines)

backend/src/
├── flows/
│   ├── flows.controller.ts          ← REST endpoints
│   ├── flows.service.ts             ← CRUD for Workflow entity
│   ├── flow-executor.service.ts     ← Orchestrates execution
│   ├── flow-validator.service.ts    ← Graph validation (DFS)
│   ├── workflow-scheduler.service.ts← Cron + MQTT triggers
│   └── flows.module.ts
├── execution/
│   ├── engine/
│   │   ├── workflow-runner.ts       ← BFS traversal engine
│   │   ├── node-executor.ts         ← Handler dispatcher
│   │   └── execution-context.ts    ← Shared execution state
│   └── handlers/                   ← 23 handler files
│       ├── input.handler.ts
│       ├── output.handler.ts
│       ├── action.handler.ts
│       ├── decision.handler.ts
│       ├── delay.handler.ts
│       ├── notification.handler.ts
│       ├── data-transform.handler.ts
│       ├── sensor-read.handler.ts
│       ├── threshold-check.handler.ts
│       ├── alert-trigger.handler.ts
│       ├── mqtt-publish.handler.ts
│       ├── pump-control.handler.ts
│       ├── station-control.handler.ts
│       ├── value-transform.handler.ts
│       ├── sensor-check.handler.ts
│       ├── stream-filter.handler.ts
│       ├── data-aggregate.handler.ts
│       ├── data-output.handler.ts
│       ├── custom-calc.handler.ts
│       └── http-request.handler.ts
└── database/entities/
    ├── Workflow.entity.ts
    └── WorkflowExecution.entity.ts
```

---

## 4. DATABASE ENTITIES

### 4.1 Workflow Entity

```typescript
// backend/src/database/entities/Workflow.entity.ts
{
  id: UUID (primary key)
  name: string
  description: string
  status: enum (draft | active | inactive | archived)
  triggerType: enum (MANUAL | SCHEDULED | SENSOR_THRESHOLD | ALERT | TIME_BASED | EXTERNAL)
  triggerConfig: JSONB          // cron string, sensorId, condition, threshold
  graph: JSONB                  // {nodes[], edges[], name, version}
  tags: string[]
  isActive: boolean
  isPublished: boolean
  executionCount: number
  lastExecutedAt: Date
  createdBy: User (relation)
  updatedBy: User (relation)
  executions: WorkflowExecution[] (relation)
  createdAt: Date
  updatedAt: Date
}
// Getter: isValid → checks graph is non-empty object
```

### 4.2 WorkflowExecution Entity

```typescript
// backend/src/database/entities/WorkflowExecution.entity.ts
{
  id: UUID
  workflow: Workflow (FK)
  status: enum (PENDING | RUNNING | COMPLETED | FAILED | CANCELLED)
  input: JSONB
  output: JSONB
  executionLog: JSONB[]          // [{nodeId, type, input, output}]
  triggerSource: string          // 'manual' | 'scheduled' | 'sensor_threshold'
  errorMessage: string
  stackTrace: string
  duration: number               // milliseconds
  nodeExecutionCount: number
  successCount: number
  failureCount: number
  nodeStates: JSONB
  currentNode: string
  metadata: JSONB
  triggeredBy: User (nullable)
  startedAt: Date
  completedAt: Date              // ⚠️ uses @UpdateDateColumn (bug: updates on every save)
}
// Getters: isRunning, isSuccessful, hasError
```

---

## 5. BACKEND EXECUTION ENGINE

### 5.1 Execution Context (`execution-context.ts`)

- Map-based value store keyed by `nodeId`
- Tracks execution steps: `{nodeId, type, input, output}[]`
- Initialized with optional input payload

```typescript
context.setValue(nodeId, value)
context.getValue(nodeId)
context.addStep({nodeId, type, input, output})
context.getSteps()
```

### 5.2 Workflow Runner (`workflow-runner.ts`)

**Algorithm: Breadth-First Search (BFS)**

```
1. Find start nodes (type='input' OR no incoming edges)
2. Add to queue
3. While queue not empty:
   a. Dequeue node
   b. Gather inputs from upstream node outputs
   c. Execute node via NodeExecutor
   d. Store result in ExecutionContext
   e. Unwrap branch envelope {value, branch}
   f. Filter outgoing edges by branch value (for decision nodes)
   g. Enqueue downstream nodes
4. Return final output from 'output' type node
```

**Socket.IO events emitted:**
- `workflow:started`
- `workflow:node-executing` — before each node
- `workflow:node-executed` — after each node
- `workflow:completed`
- `workflow:failed`

**Branch routing logic:**
```typescript
// Decision node returns: {value, branch: 'true'|'false', passed}
// WorkflowRunner filters edges:
filterDecisionEdges(edges, branch) → only edges matching branch label
// Non-decision nodes: all outgoing edges are followed
```

### 5.3 Node Executor (`node-executor.ts`)

- Dependency injection container for all 23 handlers
- Injects: SensorRepository, SensorDataRepository, NotificationRepository
- Injects services: AlertsService, MqttClient, RealtimeService, StationsService
- Special case: `delay` node → `setTimeout(duration, max 30s)`
- Backward compat: `api` type → routes to `http-request` handler

```typescript
execute(node: WorkflowNode, input: any, context: ExecutionContext): Promise<any>
```

### 5.4 Flow Executor Service (`flow-executor.service.ts`)

```typescript
async execute(graph, input, options):
  1. Create WorkflowExecution {status: RUNNING, startedAt}
  2. Call WorkflowRunner.run(graph, input, userId)
  3. On SUCCESS:
     - Save executionLog (steps array)
     - Update status → COMPLETED
     - Save duration (ms)
     - Increment workflow.executionCount
     - Set workflow.lastExecutedAt
  4. On ERROR:
     - Save errorMessage + stackTrace
     - Update status → FAILED
  5. Return ExecutionResult
```

### 5.5 Flow Validator Service (`flow-validator.service.ts`)

**Validation steps (in order):**

1. **Node array exists** and all node types are valid (23 recognized types)
2. **Edge references** — all source/target nodeIds exist in nodes array
3. **No self-loops** — source ≠ target
4. **Port-occupancy** — each input port can have at most ONE incoming edge
5. **DFS cycle detection** (3-color algorithm):
   - White = unvisited, Grey = in-stack, Black = done
   - Returns cycle path `[a, b, c, a]` if found
   - Throws `BadRequestException` if cycles exist
   - Checks ALL disconnected components

```typescript
validate(graph: WorkflowGraph): ValidationResult
// Throws BadRequestException with details on failure
```

### 5.6 Workflow Scheduler Service (`workflow-scheduler.service.ts`)

**On module init:** Loads all active scheduled workflows from DB

**Trigger type 1 — CRON:**
```typescript
registerCronJob(workflow):
  - Reads triggerConfig.cronExpression
  - Creates CronJob via @nestjs/schedule SchedulerRegistry
  - On fire: execute(workflow.graph, {}, {triggerSource: 'scheduled'})
  - Errors are caught and logged (no propagation)
```

**Trigger type 2 — SENSOR_THRESHOLD (MQTT):**
```typescript
registerSensorThresholdHandler():
  - Global MQTT handler on topic pattern: sensors/:id/data
  - Parses numeric value from MQTT payload
  - Finds all active sensor_threshold workflows with matching sensorId
  - Checks condition: any | above | below
  - If condition met: execute(workflow.graph, {sensorId, value}, {triggerSource: 'sensor_threshold'})
  - Fire-and-forget (no await)
```

---

## 6. REST API ENDPOINTS

```
POST   /flows                    → create workflow
GET    /flows                    → list all (ordered by createdAt DESC)
GET    /flows/:id                → get one
PUT    /flows/:id                → update (name, graph, triggerType, triggerConfig, isActive)
DELETE /flows/:id                → remove
GET    /flows/:id/executions     → last 50 execution records
PATCH  /flows/:id/activate       → set isActive=true + reload scheduler
PATCH  /flows/:id/deactivate     → set isActive=false + reload scheduler
POST   /flows/execute            → ad-hoc manual execution
```

All endpoints are JWT-guarded.

---

## 7. THE 23 HANDLERS

### 7.1 Generic Handlers

#### `input.handler.ts`
- Reads `node.data.value` or uses context input
- Attempts JSON.parse to coerce strings → numbers/objects/arrays/booleans
- Falls back to original string if parse fails

#### `output.handler.ts`
- Format coercion: `number` → Number(input), `text` → String(input)
- Marks the workflow's final output

#### `action.handler.ts`
- Operations: `multiply`, `add`, `subtract`, `divide`, `uppercase`, `append`
- Math ops: coerce input to number
- Text ops: coerce to string
- Divide by zero: returns original value

#### `decision.handler.ts`
- Returns `{value, branch: 'true'|'false', passed}`
- Operators: `>`, `>=`, `<`, `<=`, `==`, `!=`
- WorkflowRunner uses branch to filter outgoing edges

#### `delay.handler.ts`
- Configurable duration (max 30 seconds enforced)
- Returns input unchanged after delay

#### `notification.handler.ts`
- Channels: `in_app` (default), `webhook`
- ⚠️ `email`, `sms`, `slack` all fall back to `in_app` (NOT implemented)
- `in_app`: persists Notification entity + Socket.IO broadcast
- `webhook`: HTTP POST `{subject, content, data, timestamp}` to configured URL
- Returns `{notified: boolean, channel, ...metadata}`

#### `data-transform.handler.ts`
- Operations: `extract_field`, `set_field`, `delete_field`, `to_number`, `to_string`, `parse_json`, `stringify_json`
- Returns `{value, branch: 'out'|'error'}`
- Catches parse errors → routes to `error` port

---

### 7.2 Industrial Core Handlers

#### `sensor-read.handler.ts` — 5 operations

| Operation | Returns |
|-----------|---------|
| `single` | `{sensorId, name, value, unit, timestamp, status, stationId}` |
| `history` | `{readings: [{id, value, timestamp}], count, branch: 'readings'}` |
| `batch` | `{sensors: [{sensorId, name, type, value, unit, status, stationId, stationName}], count, branch: 'sensors'}` |
| `status_check` | `{status, lastReadingAt, minutesSince, branch: 'online'|'offline'}` — timeout default 5min |
| `delta` | `{current, previous, change, changePercent, direction, significant, branch: 'significant'|'stable'}` |

#### `threshold-check.handler.ts`
- Accepts `{value}` object or bare number
- Modes: `between` (min AND max), `above_max`, `below_min`
- Returns `{value, breach, pass, min, max, mode, branch: 'breach'|'pass'}`

#### `alert-trigger.handler.ts`
- Creates persistent Alert via AlertsService
- Validates type/severity enums → defaults: `SYSTEM_ERROR` / `WARNING`
- Returns `{alertId, severity, message, status}`

#### `mqtt-publish.handler.ts`
- Default topic: `aquaflow/commands`
- Merges static JSON payload with incoming object
- Wraps bare values as `{value}`
- Returns `{published: true, topic, payload}`

#### `pump-control.handler.ts`
- Commands: `start`, `stop`, `toggle`
- MQTT topic: `devices/{deviceId}/commands`
- Payload: `{command, deviceId, timestamp, source: 'workflow'}`
- Returns `{sent: true, command, deviceId, topic}`

#### `station-control.handler.ts`
- Updates station status via `StationsService.update()`
- Statuses: `normal`, `warning`, `critical`, `offline`
- Returns `{updated: true, stationId, name, status}`

---

### 7.3 Industrial Extended Handlers

#### `value-transform.handler.ts` — 5 operations

| Operation | Description |
|-----------|-------------|
| `normalize` | Linear scaling `[inputMin, inputMax]` → `[outputMin, outputMax]` |
| `unit_convert` | Temperature (C/F/K), Pressure (bar/psi/mbar/Pa), Flow (m³/h / L/s / L/min), Length (m/ft/cm) |
| `round` | `floor` / `ceil` / `round` to N decimals |
| `clamp` | Clip to range → `{outOfRange: boolean, branch: 'out'|'clamped'}` |
| `map` | Map numeric states to labels e.g. `{0: 'closed', 1: 'open'}` → `{label, branch: 'out'|'unknown'}` |

All return values rounded to 4 decimal places.

#### `sensor-check.handler.ts` — 6 operations

| Operation | Description |
|-----------|-------------|
| `multi_threshold` | 4-level routing: `normal` / `warning` / `critical` / `emergency` |
| `rate_of_change` | Detects too_fast/too_slow based on max/min rates per second |
| `deadband` | Suppresses events when change < width (absolute or percent mode) |
| `anomaly` | Z-score outlier detection on array (default 3σ threshold) |
| `compare` | Compares two values with tolerance → `{branch: 'equal'|'a_greater'|'b_greater'}` |
| `time_window` | Gates execution to configured hours/days of week → `{branch: 'allowed'|'blocked'}` |

#### `stream-filter.handler.ts` — 4 operations

| Operation | Description |
|-----------|-------------|
| `debounce` | Collapses array to newest item |
| `throttle` | Keeps first of every N items |
| `sample` | Downsamples to every Nth item |
| `burst_detect` | Fires `burst` port when count ≥ threshold |

Arrays processed; single values pass through.

#### `data-aggregate.handler.ts` — 5 operations

| Operation | Description |
|-----------|-------------|
| `stats` | Computes min, max, avg, median, stddev, p95 on numeric array |
| `station_stats` | Aggregates readings across station sensors (count + active count) |
| `event_counter` | Counts items → `{branch: 'threshold_reached'|'out'}` |
| `trend` | Linear regression slope on window → `{branch: 'rising'|'falling'|'stable'}` |
| `moving_average` | Average of last N values |

#### `data-output.handler.ts` — 4 operations

| Operation | Description |
|-----------|-------------|
| `log` | Writes numeric value to SensorData table, updates sensor.lastReading |
| `report_builder` | Assembles JSON report with title, readings, optional stats |
| `csv_format` | Converts array to CSV with configurable delimiter, columns, header |
| `enrich` | Attaches sensor/station metadata to input object |

#### `custom-calc.handler.ts`
- Fetches up to **4 sensor time series** (variables: a, b, c, d)
- Aligns them using resampling strategies:
  - `interpolate` (linear)
  - `forward_fill` (step)
  - `downsample` (bucket aggregation)
- Evaluates math formula using **mathjs** library
- Aggregation modes: `mean`, `min`, `max`, `sum`, `last`
- Returns `{result, series, count, formula, aggregation, resampleStrategy, variables}`
- ⚠️ Division by zero: silently skips timestamp (no warning)

#### `http-request.handler.ts`
- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- Merges static JSON body with input object
- Attempts JSON.parse on response; falls back to plain text
- Returns `{ok, status, statusText, data, value, branch: 'response'|'error'}`
- ⚠️ No timeout configured (uses fetch defaults)

---

## 8. FRONTEND — CANVAS & GRAPH MANAGEMENT

### 8.1 `useJointGraph.js` — Core Hook

**JointJS setup:**
```javascript
graph = new dia.Graph()
paper = new dia.Paper({
  gridSize: 20,
  background: '#f8fafc',
  validateConnection: (src, srcPort, tgt, tgtPort) => {
    // Rules:
    // 1. Output → Input only
    // 2. No self-loops
    // 3. One incoming edge per input port
  }
})
```

**UndoRedoManager class (custom, no @joint/plus):**
```javascript
push(snapshot)           // append, discard redo branch
pushDebounced(snap, 200ms) // debounced for position changes
flushDebounce()          // force commit in-flight
reset(initialSnap)       // wipe history, set baseline
pause() / resume()       // suppress pushes during programmatic restore
```

**Key methods:**
```javascript
addNode(type, position)           // creates node via blockFactory
updateSelectedNode(properties)    // updates node.workflow.data
deleteSelectedNode()              // removes node + clears selection
duplicateSelectedNode()           // clones node +36px offset
importWorkflow(workflow)          // pauses history, deserializes, resets
undo() / redo()                   // flush debounce, apply snapshot
setPaperZoom(zoom)                // clamp [0.45, 1.8]
resetView()                       // scale=1, translate(0,0)
fitToScreen()                     // scaleContentToFit, padding=40px, range[0.2, 2.0]
```

**Events wired:**
- Structural changes → immediate snapshot push
- Position changes → debounced 200ms push
- Click → select node
- Double-click → open properties (onEdit callback)
- Blank click → deselect

### 8.2 `blockFactory.js`

```javascript
createWorkflowNode(type, position, overrides):
  - Fetches block definition from registry
  - Creates JointJS Rectangle with ports
  - Ports: input (left, 6px circles), output (right, 6px circles)
  - Stores metadata in node.get('workflow'): {type, title, icon, color, data}
  - Sets label from data.label || definition.title

createWorkflowLink(source, target):
  - JointJS Link: 2px stroke, arrow marker
  - Router: manhattan, Connector: rounded
  - workflow.type = 'edge'

updateNodeProperties(node, properties):
  - Merges new properties into node.workflow.data
  - Updates label
```

### 8.3 `blockRegistry.js`

```javascript
// In-memory Map: type → definition
getBlockDefinition(type)     // lookup
getBlockTypes()              // all as array
getBlockCategories()         // grouped by category field
getDefaultProperties(type)   // initializes with field.defaultValue || ""
```

### 8.4 `blocks.js` — 23 Block Definitions

**Structure of each block:**
```javascript
{
  type: string,
  title: string,
  icon: string,           // FontAwesome icon name
  category: string,       // Data | Logic | Timing | Messaging | Industrial | Integration
  description: string,
  color: string,          // hex color
  inputs: [{id, label}],  // input ports
  outputs: [{id, label}], // output ports
  properties: [{
    name: string,
    label: string,
    type: 'text'|'number'|'select'|'textarea'|'datetime-local'|'station-select'|'sensor-select',
    defaultValue: any,
    options: [{value, label}],    // for select type
    showFor: string[],            // conditional display by operation
    showWhen: {field, values}     // conditional display by field value
  }]
}
```

**Block categories:**
| Category | Blocks |
|----------|--------|
| Generic | input, output, action, decision, delay, data-transform, notification |
| Industrial | sensor-read, threshold-check, pump-control, alert-trigger, mqtt-publish, station-control, value-transform, sensor-check, data-aggregate, stream-filter, data-output, custom-calc |
| Integration | http-request |

---

## 9. FRONTEND — ENGINE FILES

### 9.1 `graphSerializer.js`

```javascript
serializeGraph(graph, workflowId):
  returns {
    id?,             // only if real UUID (not 'new')
    name,
    version: 1,
    updatedAt,
    nodes: [{id, type, position, size, data}],
    edges: [{id, source, sourcePort, target, targetPort}]
  }

downloadWorkflowJson(workflow):
  // Creates Blob → triggers browser download as {name}.json
```

### 9.2 `graphDeserializer.js`

```javascript
deserializeGraph(graph, workflow):
  1. Clear existing graph
  2. Create nodes via blockFactory (migrates 'api' → 'http-request')
  3. Create links between nodes
  4. Defaults: sourcePort='out', targetPort='in' if missing
  5. Skips edges to non-existent nodes gracefully

LEGACY_TYPE_MAP = { 'api': 'http-request' }
```

### 9.3 `autosaveManager.js`

```javascript
// localStorage keys:
// workflow-draft:{id}
// workflow-trigger:{id}
// Legacy (id='new'): workflow-builder-autosave

saveWorkflowDraft(workflow, id)
loadWorkflowDraft(id)          // tries keyed, then legacy
saveTriggerSettings(settings, id)
loadTriggerSettings(id)
clearWorkflowDraft(id)
clearTriggerSettings(id)
// Silent catch on storage quota exceeded
```

### 9.4 `executionHistoryManager.js`

```javascript
// localStorage key: workflow-history:{workflowId}
// Max: 50 records per workflow (auto-evict oldest)
// Output truncated to 800 chars to prevent storage bloat

Record shape: {
  id: timestamp + 5-char random suffix,
  timestamp,
  durationMs,
  status: 'success'|'failed',
  output: string (truncated 800 chars),
  error: string,
  workflowId
}

saveExecutionRecord(workflowId, record)  // no-op for 'new' workflows
loadExecutionHistory(workflowId)         // returns [] if missing
clearExecutionHistory(workflowId)
```

---

## 10. FRONTEND — UI ORCHESTRATION

### 10.1 `BuilderPage.jsx`

**State:**
```javascript
editor = useWorkflowEditor()     // graph + execution state
triggerSettings = {              // lazy init from localStorage
  name, triggerType, triggerConfig, isActive
}
// Modal flags: settingsOpen, pickerOpen, historyOpen, saveModalOpen, libraryOpen
```

**Two-step save flow:**
```
1. User clicks Save → opens SaveNameModal
2. Confirm name:
   a. Merge name into triggerSettings
   b. Save draft + settings to localStorage
   c. Call saveWorkflow API
   d. If first save (id='new' → real UUID):
      - Clear 'new' localStorage slots
      - Rebind to real UUID slots
```

**Layout:**
```
Header (toolbar: Save | Load | Settings | History | Library | name | trigger badge | Active)
├── BlockSidebar    (left panel)
├── FlowCanvas      (center panel - JointJS paper)
└── PropertiesPanel (right panel)
+ ExecutionResultPanel (bottom, shows last run result)
+ Modals (save, settings, history, library, picker)
```

**Toolbar badges:**
- `⏱` = SCHEDULED trigger
- `📡` = SENSOR_THRESHOLD trigger
- `manual` = MANUAL trigger
- `Active` toggle = isActive flag

### 10.2 `useWorkflowEditor.js`

Composes: `useJointGraph` + `useAutosave` + `useExecutionFeedback`

```javascript
execute():
  1. Call executeWorkflowGraph(workflow)
  2. On success: {result, startedAt, durationMs}
  3. On error: {error: message, startedAt, durationMs}
  4. Save execution record to localStorage
  5. Update executionResult state

exportJson()     // downloads workflow JSON
importJsonFile(file) // reads file, imports to graph
loadAutosave()   // reads draft from localStorage
```

---

## 11. WORKFLOW GRAPH JSON FORMAT

```json
{
  "id": "uuid-here",
  "name": "My Workflow",
  "version": 1,
  "updatedAt": "2026-06-07T10:00:00Z",
  "nodes": [
    {
      "id": "node-uuid",
      "type": "sensor-read",
      "position": {"x": 100, "y": 200},
      "size": {"width": 120, "height": 60},
      "data": {
        "operation": "single",
        "sensorId": "sensor-uuid"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-uuid",
      "source": "node-uuid-1",
      "sourcePort": "out",
      "target": "node-uuid-2",
      "targetPort": "in"
    }
  ]
}
```

---

## 12. TRIGGER CONFIGURATION FORMAT

```json
// SCHEDULED
{
  "cronExpression": "0 */6 * * *"
}

// SENSOR_THRESHOLD
{
  "sensorId": "sensor-uuid",
  "condition": "above",        // any | above | below
  "threshold": 85.0
}
```

---

## 13. EXECUTION RESULT FORMAT

```json
{
  "status": "COMPLETED",
  "output": { "value": 42.5 },
  "duration": 1234,
  "steps": [
    {
      "nodeId": "node-1",
      "type": "sensor-read",
      "input": {},
      "output": { "value": 85.2, "unit": "°C" }
    }
  ],
  "nodeExecutionCount": 5,
  "successCount": 5,
  "failureCount": 0
}
```

---

## 14. BRANCH ROUTING SYSTEM

Branch routing is how decision nodes control flow:

```
Decision node output: {value: 42, branch: 'true', passed: true}
                                         ↓
WorkflowRunner.filterDecisionEdges():
  - Edge labeled 'true'  → followed ✅
  - Edge labeled 'false' → skipped  ❌

Other nodes with branch:
  - threshold-check: branch 'breach' | 'pass'
  - sensor-read status_check: branch 'online' | 'offline'
  - data-transform: branch 'out' | 'error'
  - value-transform clamp: branch 'out' | 'clamped'
  - http-request: branch 'response' | 'error'
  - sensor-check time_window: branch 'allowed' | 'blocked'
```

---

## 15. KNOWN ISSUES & LIMITATIONS

| Location | Issue | Severity |
|----------|-------|---------|
| `notification.handler.ts` | email/sms/slack → all redirect to in_app | ⚠️ Medium |
| `http-request.handler.ts` | No timeout on HTTP requests | ⚠️ Medium |
| `WorkflowExecution.completedAt` | Uses @UpdateDateColumn → updates on every save, not just completion | ⚠️ Medium |
| `custom-calc.handler.ts` | Division by zero silently skips timestamp | ⚠️ Low |
| `graphSerializer.js` | version hardcoded to 1, no migration logic | ⚠️ Low |
| `sensor-read delta` | Returns {branch} not wrapped in {value} like others | ⚠️ Low |
| Undo/Redo | Debounce only on position moves, not property edits | ℹ️ Info |
| `autosaveManager` | Storage quota exceeded: silent catch (data lost) | ⚠️ Low |

---

## 16. ARCHITECTURAL PATTERNS USED

| Pattern | Where | Description |
|---------|-------|-------------|
| **BFS Traversal** | WorkflowRunner | Nodes executed in topological order via queue |
| **Branch Envelope** | Decision + sensor handlers | `{value, branch}` for conditional routing |
| **Port-occupancy** | Validator + JointJS | One incoming edge per input port enforced at 2 layers |
| **3-color DFS** | FlowValidatorService | Cycle detection (white/grey/black) |
| **Snapshot Undo/Redo** | UndoRedoManager | Full graph serialization on each change |
| **localStorage Tiers** | autosaveManager | Per-workflow slots, migrated on first real save |
| **Async-first persistence** | BuilderPage | Save locally first, then sync to API |
| **Backward compatibility** | Deserializer + Validator | `api` type → `http-request` silently |
| **Fire-and-forget** | MQTT threshold scheduler | No await on triggered executions |

---

## 17. QUICK REFERENCE — BLOCK TYPES SUMMARY

| Type | Category | Key Properties | Output Branch |
|------|----------|---------------|---------------|
| input | Generic | value | — |
| output | Generic | format | — |
| action | Generic | operation, operand | — |
| decision | Generic | operator, compareValue | true/false |
| delay | Generic | duration (ms, max 30000) | — |
| notification | Generic | channel, subject, content | — |
| data-transform | Generic | operation, field, value | out/error |
| sensor-read | Industrial | operation, sensorId | varies by op |
| threshold-check | Industrial | min, max, mode | breach/pass |
| alert-trigger | Industrial | type, severity, message | — |
| mqtt-publish | Industrial | topic, payload | — |
| pump-control | Industrial | command, deviceId | — |
| station-control | Industrial | stationId, status | — |
| value-transform | Industrial | operation | varies by op |
| sensor-check | Industrial | operation | varies by op |
| stream-filter | Industrial | operation, size | varies by op |
| data-aggregate | Industrial | operation | varies by op |
| data-output | Industrial | operation | — |
| custom-calc | Industrial | formula, sensorA/B/C/D | — |
| http-request | Integration | method, url, body | response/error |

---

## 18. HOW TO RUN

```bash
# Full stack
docker-compose up --build

# Backend only
cd backend && npm run start:dev    # port 3001

# Frontend only
cd frontend && npm start           # port 3000

# Swagger API docs
http://localhost:3001/api/docs

# Workflow Builder UI
http://localhost:3000/#/admin/automation
```

**Demo credentials:**
```
admin@aquaflow.local      / Admin123!
operator@aquaflow.local   / Operator123!
technician@aquaflow.local / Tech123!
analyst@aquaflow.local    / Analyst123!
```
