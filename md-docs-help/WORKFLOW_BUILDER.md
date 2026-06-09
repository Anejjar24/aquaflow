# Workflow Builder — Complete Architecture Explanation

---

## What Is It?

The Workflow Builder (also called Automation Builder) is a **visual programming tool** built into AquaFlow. It lets operators drag-and-drop processing blocks onto a canvas, connect them with edges, configure their properties, and then execute the resulting graph as a live automation — reading real sensors, triggering alerts, publishing MQTT commands, and more. It is a **no-code automation engine** sitting on top of all other system domains.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
│                                                                      │
│  BuilderPage.jsx  ←── top-level page, assembles all 4 panels        │
│       │                                                              │
│  ┌────▼─────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │ BlockSidebar │  │   FlowCanvas     │  │  PropertiesPanel    │   │
│  │  (drag src)  │  │  (JointJS paper) │  │  (node config)      │   │
│  └──────────────┘  └──────────────────┘  └─────────────────────┘   │
│                          │                                           │
│                    useWorkflowEditor()  ← central state hook        │
│                    useJointGraph()      ← JointJS wrapper           │
│                    useAutosave()        ← localStorage debounce     │
│                                                                      │
│  engine/  ─── graphSerializer, graphDeserializer, autosaveManager  │
│  registry/ ── blockRegistry, blockFactory (JointJS cell builders)  │
│  data/     ── blocks.js (14 block definitions)                      │
│  services/ ── workflowApi.js (Axios calls to backend)              │
└──────────────────────────────────────────────────────────────────────┘
                              │  HTTP (Axios)
                              │  POST /flows          (save)
                              │  POST /flows/execute  (run)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        BACKEND (NestJS)                              │
│                                                                      │
│  FlowsModule                                                         │
│  ├── FlowsController        (REST routing)                          │
│  ├── FlowsService           (CRUD → Workflow entity)                │
│  ├── FlowExecutorService    (validate → run)                        │
│  ├── FlowValidatorService   (whitelist check)                       │
│  │                                                                   │
│  └── execution/                                                     │
│       ├── engine/                                                    │
│       │   ├── WorkflowRunner   (BFS graph traversal)                │
│       │   ├── NodeExecutor     (switch → handler dispatch)          │
│       │   └── ExecutionContext (per-run value store + step log)     │
│       │                                                              │
│       └── handlers/  (one file per block type — 14 total)          │
│           ├── input, action, decision, output, delay, api,          │
│           │   notification (generic — no external deps)             │
│           └── sensor-read, threshold-check, alert-trigger,          │
│               mqtt-publish, pump-control, station-control,          │
│               http-request (industrial — inject real services)      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Frontend — Folder by Folder

### `src/pages/BuilderPage.jsx`

The **top-level page component**. It is the single entry point for the entire builder UI. It:

- Calls `useWorkflowEditor()` to get the full editor state object.
- Renders the 3-panel layout: `BlockSidebar` | `FlowCanvas` | `PropertiesPanel`.
- Hosts the `NodeEditorModal` (double-click popup editor).
- Handles the **Save** action: serializes the graph → saves to localStorage draft → POSTs to backend.
- Shows a toast message (`editor.editorMessage`) for user feedback.

```jsx
// The whole builder in one render:
<BlockSidebar />
<FlowCanvas editor={editor} onSave={handleSave} />
<PropertiesPanel editor={editor} />
<NodeEditorModal ... />
```

> `src/views/builder/BuilderPage.jsx` and `src/components/builder/BuilderCanvas.jsx` are just re-export aliases — the real implementation lives in `src/pages/BuilderPage.jsx`.

---

### `src/components/Blocksidebar/`

The **left sidebar** — a palette of draggable blocks.

| File | Role |
|------|------|
| `BlockSidebar.jsx` | Reads categories from `blockRegistry`, renders a search box and a list of `BlockCategory` components |
| `BlockCategory.jsx` | Renders one collapsible group (e.g. "Industrial", "Logic") with its blocks |
| `BlockSearch.jsx` | Controlled text input; filters blocks by title, description, category |

**How drag works:** Each block card sets `event.dataTransfer.setData("application/workflow-block", type)` on `dragstart`. The canvas listens for `drop` and reads that type string to create the node.

---

### `src/components/canvas/`

The **center panel** — the visual graph editor.

| File | Role |
|------|------|
| `FlowCanvas.jsx` | Wrapper — on mount, loads the autosaved draft (or a starter workflow) by calling `deserializeGraph`. Renders `CanvasToolbar` + `JointPaper`. |
| `JointPaper.jsx` | Owns the actual DOM `<div>` that JointJS mounts into. Sets up: drag-drop handler, middle-mouse panning, keyboard shortcuts (Delete / Ctrl+D), `ResizeObserver` to keep paper dimensions in sync when the browser window changes. |
| `CanvasToolbar.jsx` | The top bar with buttons: Save, Export JSON, Import JSON, Zoom In/Out, Reset View, Duplicate, Delete, **Run**. The Run button is the trigger for execution. |

---

### `src/components/properties/`

The **right panel** — node configuration.

| File | Role |
|------|------|
| `PropertiesPanel.jsx` | Shows config fields for the currently selected node. Reads `editor.selectedNode`, looks up the block definition, and renders a `PropertyField` for each property. Also shows the **Execution Result** JSON after a run. |
| `NodeEditorModal.jsx` | A modal popup opened on **double-click** of a node. Same data as PropertiesPanel but in a modal form. |
| `PropertyField.jsx` | Renders one input field: `text`, `number`, `select`, or `textarea` depending on `field.type`. |

---

### `src/data/blocks.js`

The **single source of truth** for all 14 block types. Each entry defines:

```js
{
  type: "sensor-read",          // unique identifier
  title: "Sensor Read",         // display name
  icon: "fa-microchip",         // FontAwesome icon
  category: "Industrial",       // sidebar group
  description: "...",           // tooltip / property panel
  color: "#0ea5e9",             // node border color
  inputs: [{ id: "trigger", label: "Trigger" }],   // left-side ports
  outputs: [{ id: "value", label: "Value" }, ...],  // right-side ports
  properties: [...]             // configurable fields shown in panel
}
```

**14 block types across 4 categories:**

| Category | Blocks |
|----------|--------|
| Data | `input`, `output` |
| Logic | `action`, `decision` |
| Timing | `delay` |
| Messaging | `notification` |
| Integrations (generic) | `api` |
| Industrial | `sensor-read`, `threshold-check`, `alert-trigger`, `mqtt-publish`, `pump-control`, `station-control` |
| Integration (real HTTP) | `http-request` |

---

### `src/registry/`

| File | Role |
|------|------|
| `blockRegistry.js` | Wraps `blocks.js` in a `Map<type, definition>`. Exposes `getBlockDefinition(type)`, `getBlockCategories()`, `getDefaultProperties(type)`. Used by both the sidebar and the factory. |
| `blockFactory.js` | Converts a block type string into an actual **JointJS `shapes.standard.Rectangle` cell**. Sets ports (left = inputs, right = outputs), sets colors/fonts from the definition, and stores the workflow metadata in `node.set("workflow", {...})`. Also exports `createWorkflowLink()` for styled edges and `updateNodeProperties()`. |

The `workflow` property stored on each JointJS cell is the key data bridge — it carries `type`, `title`, `icon`, `color`, and `properties` (the user-configured values).

---

### `src/engine/`

| File | Role |
|------|------|
| `graphSerializer.js` | Reads the live JointJS graph (`graph.getElements()`, `graph.getLinks()`) and produces a plain JSON object: `{ id, name, version, nodes[], edges[] }`. This is the format sent to the backend. Also exports `downloadWorkflowJson()` for the Export button. |
| `graphDeserializer.js` | Takes a workflow JSON and rebuilds the JointJS graph using `blockFactory.createWorkflowNode()` and `createWorkflowLink()`. Used on page load (restore draft) and on Import. |
| `autosaveManager.js` | Three functions: `saveWorkflowDraft(workflow)` → `localStorage`, `loadWorkflowDraft()` → parse JSON from localStorage, `clearWorkflowDraft()`. |
| `workflowExecutorClient.js` | Thin shim: calls `executeWorkflow(workflow)` from `workflowApi.js`. Exists as a separation boundary so execution logic could later be made local without changing the hook. |

---

### `src/hooks/`

| File | Role |
|------|------|
| `useJointGraph.js` | The **JointJS state manager**. Creates `dia.Graph` and `dia.Paper`, wires up all paper events (click → `setSelectedNode`, double-click → `onEdit`, blank click → deselect, graph mutations → `refreshWorkflow`). Exposes: `addNode`, `updateSelectedNode`, `deleteSelectedNode`, `duplicateSelectedNode`, `importWorkflow`, `setPaperZoom`, `resetView`. |
| `useAutosave.js` | Watches `workflow` (the serialized graph JSON object). If it changed, waits 600 ms (debounce), then calls `saveWorkflowDraft()`. Shows status string: "Saving" → "Saved 12:34:56". |
| `useWorkflowEditor.js` | **The master hook**. Composes `useJointGraph` + `useAutosave` + local state for `executionResult`, `isExecuting`, `editorMessage`, `editingNode`. Adds the `execute()` async function and `importJsonFile()` (FileReader wrapper). Returns the complete editor API consumed by `BuilderPage`. |

---

### `src/services/workflowApi.js`

Two functions, both using the shared `apiClient` (Axios instance with JWT interceptors):

```js
saveWorkflow(workflow)    →  POST /flows         { name, graph }
executeWorkflow(workflow) →  POST /flows/execute  { graph, input: {} }
```

---

## Backend — Folder by Folder

### `src/flows/` — The Flow Module

This is the NestJS module that owns all workflow-related HTTP endpoints and wires up the execution engine.

#### `flows.module.ts`

Declares all providers and imports:

- **TypeORM entities:** `Workflow` (for persistence) + `Sensor` (for `NodeExecutor` to query sensor readings)
- **Imported modules:** `AlertsModule` (so handlers can create alerts), `IotModule` (provides `MqttClient`), `StationsModule` (for station-control handler)
- **Providers:** `FlowsService`, `FlowExecutorService`, `FlowValidatorService`, `WorkflowRunner`, `NodeExecutor`

---

#### `flows.controller.ts`

The REST layer. All routes are protected by `JwtGuard`.

| Method | Path | What it does |
|--------|------|--------------|
| `POST` | `/flows` | Save a workflow to the DB (validates graph first) |
| `GET` | `/flows` | List all saved workflows (newest first) |
| `GET` | `/flows/:id` | Get one workflow by UUID |
| `PUT` | `/flows/:id` | Replace a workflow's graph |
| `DELETE` | `/flows/:id` | Delete a workflow |
| `POST` | `/flows/execute` | **Ad-hoc execute** — runs the graph without saving |

The critical one is `POST /flows/execute` — the frontend's "Run" button hits this endpoint.

---

#### `flows.service.ts`

CRUD for the `Workflow` entity (PostgreSQL, via TypeORM):

- `create()` — validates graph, generates UUID if none, saves with `createdBy` user.
- `findAll()` — returns all workflows with the creator's user object joined.
- `update()` — re-validates on every save; tracks `updatedBy`.
- `remove()` — hard delete.

---

#### `flow-validator.service.ts`

**Guard before any execution or save.** It does three things:

1. Checks every node's `type` against a whitelist Set of 14 valid types. Throws `400 Bad Request` if unknown.
2. Checks every edge references nodes that actually exist in the graph. Throws `400` if dangling.
3. Rejects self-referencing edges (a node connected to itself).

> This was the source of the "Invalid node" bug — the whitelist originally only had 7 types, blocking all industrial blocks.

---

#### `flow-executor.service.ts`

A thin orchestrator with one method:

```typescript
async execute(graph, input) {
  this.validator.validate(graph);      // throw 400 if invalid
  return this.runner.run(graph, input); // BFS execution
}
```

Separates the "is this graph valid?" question from the "run it" question.

---

#### `dto/create-flow.dto.ts` and `dto/execute-flow.dto.ts`

Simple validation DTOs:

- `CreateFlowDto`: `name?` (string) + `graph` (object)
- `ExecuteFlowDto`: `graph` (object) + `input?` (object)

---

### `src/execution/` — The Execution Engine

A pure computation layer with no HTTP endpoints. Injected into the flows module via NestJS DI.

#### `engine/execution-context.ts`

A **per-run in-memory store**. Lives only for the duration of one `runner.run()` call.

```typescript
class ExecutionContext {
  private values = new Map<string, unknown>();  // nodeId → output
  readonly steps: ExecutionStep[] = [];          // execution log

  setValue(nodeId, value) { ... }
  getValue(nodeId) { ... }
  addStep(step) { ... }
}
```

This is how nodes pass data to each other: node A writes its output via `context.setValue(nodeA.id, result)`, then node B reads `context.getValue(nodeA.id)` as its input.

---

#### `engine/workflow-runner.ts`

The **BFS graph traversal engine**. Given a graph and initial input:

1. Builds two index maps: `outgoing` (source → edges) and `incoming` (target → edges).
2. Finds **start nodes**: nodes of type `input` OR nodes with no incoming edges.
3. Runs a **BFS queue**:
   - Dequeue node → look up its input from `context` (or fall back to the global `input` for start nodes).
   - Call `nodeExecutor.execute(node, input, context)`.
   - Store output in `context`, log the step.
   - Filter next edges by branch (see below).
   - Push next nodes onto the queue.
4. Returns `{ workflowId, status: "success", output, steps[] }`.

**Port-based routing (`filterDecisionEdges`):** If a node's output contains a `branch` field (e.g. `{ branch: "breach" }`), only edges whose `sourcePort` matches that branch name are followed. This is how `decision` → `true`/`false` and `threshold-check` → `pass`/`breach` routing works.

---

#### `engine/node-executor.ts`

The **dispatch layer**. One `switch(node.type)` statement routes each node type to its handler:

```typescript
switch (node.type) {
  case 'input':           return inputHandler.execute(node, context);
  case 'action':          return actionHandler.execute(node, input);
  case 'decision':        return decisionHandler.execute(node, input);
  case 'sensor-read':     return sensorReadHandler.execute(node);
  case 'threshold-check': return thresholdCheckHandler.execute(node, input);
  case 'alert-trigger':   return alertTriggerHandler.execute(node, input);
  case 'mqtt-publish':    return mqttPublishHandler.execute(node, input);
  case 'pump-control':    return pumpControlHandler.execute(node, input);
  case 'station-control': return stationControlHandler.execute(node, input);
  case 'http-request':    return httpRequestHandler.execute(node, input);
  // ...
}
```

**Two classes of handlers:**

- **Generic handlers** — instantiated directly as plain classes (`new InputHandler()`). No external dependencies.
- **Industrial handlers** — instantiated in the constructor with injected services (`new SensorReadHandler(sensorRepository)`, `new AlertTriggerHandler(alertsService)`, etc.).

---

#### `handlers/` — 14 Handler Files

Each handler has one `execute(node, input?)` method:

| Handler file | What it does | Output shape |
|-------------|-------------|-------------|
| `input.handler.ts` | Returns `node.data.value` (or pulls from execution context initial input) | raw value |
| `action.handler.ts` | Applies math/string operations (multiply, add, subtract, divide, uppercase, append) to `input` | transformed value |
| `decision.handler.ts` | Compares `input` against `node.data.compareTo` using the configured operator (`>`, `>=`, `<`, `<=`, `==`, `!=`) | `{ value, branch: "true"/"false", passed }` |
| `output.handler.ts` | Formats `input` as json/text/number | formatted value |
| `delay` (inline in NodeExecutor) | `setTimeout` up to 30 s, then passes `input` through unchanged | `input` |
| `sensor-read.handler.ts` | Queries DB for `Sensor` by `node.data.sensorId`, returns `lastReading` and metadata | `{ sensorId, name, value, unit, timestamp, status }` |
| `threshold-check.handler.ts` | Extracts `.value` from the sensor-read output object, compares against `minThreshold`/`maxThreshold` per the configured `mode` | `{ value, breach, pass, branch: "pass"/"breach" }` |
| `alert-trigger.handler.ts` | Calls `alertsService.create()` — inserts an Alert row in DB | `{ alertId, severity, message, status }` |
| `mqtt-publish.handler.ts` | Calls `mqttClient.publish(topic, payload)` | `{ topic, published: true }` |
| `pump-control.handler.ts` | Publishes `{ command }` to `devices/{deviceId}/control` MQTT topic | `{ deviceId, command, topic, sent: true }` |
| `station-control.handler.ts` | Calls `stationsService.update()` to change a station's status in the DB | `{ stationId, status, updated: true }` |
| `http-request.handler.ts` | Makes a real external HTTP call via `node-fetch` with configured method, URL, headers, body | `{ status, data, ok }` or `{ error }` |

---

## Communication Flow — End to End

Here is exactly what happens when you click **Run**:

```
1. [CanvasToolbar] User clicks Run
       ↓
2. [useWorkflowEditor.execute()] calls graph.refreshWorkflow()
       ↓
3. [graphSerializer.serializeGraph()] reads JointJS cells → builds JSON:
   { id, name, nodes:[{id, type, position, data:{...properties}}], edges:[{source, sourcePort, target, targetPort}] }
       ↓
4. [workflowExecutorClient.executeWorkflowGraph(workflow)]
   → workflowApi.executeWorkflow(workflow)
   → Axios POST /flows/execute { graph: workflow, input: {} }
       ↓ HTTP
5. [FlowsController.execute()] → FlowExecutorService.execute(graph, input)
       ↓
6. [FlowValidatorService.validate(graph)] — checks all node types + edges. Throws 400 if invalid.
       ↓
7. [WorkflowRunner.run(graph, input)] — BFS:
   a. Creates ExecutionContext
   b. Finds start nodes (input type or no incoming edges)
   c. For each node in queue:
      - Gets input from context (or global input for start nodes)
      - Calls NodeExecutor.execute(node, input, context)
      - Stores output in context
      - Logs step
      - Filters next edges by branch (if output has a branch field)
      - Pushes next nodes to queue
       ↓
8. [NodeExecutor.execute()] dispatches to the correct handler
       ↓
9. [Handler] runs its logic:
   - sensor-read    → SELECT from Sensor table
   - threshold-check → math comparison
   - alert-trigger  → INSERT into Alert table
   - mqtt-publish   → MQTT broker publish
   - station-control → UPDATE Station table
   - http-request   → external HTTP fetch
       ↓
10. WorkflowRunner returns { workflowId, status:"success", output, steps:[] }
        ↓ HTTP response
11. [useWorkflowEditor] → setExecutionResult(result)
        ↓
12. [PropertiesPanel] renders the steps JSON in the "Execution" section
```

---

## Save Flow (separate from Execute)

```
User clicks Save (or autosave fires after 600 ms idle)
    ↓
graph.refreshWorkflow() → serialized JSON
    ↓
autosaveManager.saveWorkflowDraft(workflow) → localStorage  (local backup, instant)
    ↓
workflowApi.saveWorkflow(workflow) → POST /flows { name, graph }
    ↓
FlowsController.create() → FlowsService.create()
    → validator.validate(graph)  (same whitelist check)
    → workflowRepository.save({ id, name, graph, createdBy: req.user })
    → returns saved Workflow entity
```

---

## Data Format: What the Graph JSON Looks Like

```json
{
  "id": "local-workflow",
  "name": "Workflow Builder",
  "version": 1,
  "updatedAt": "2026-05-14T10:00:00.000Z",
  "nodes": [
    {
      "id": "sensor-node-1",
      "type": "sensor-read",
      "position": { "x": 80, "y": 120 },
      "size": { "width": 190, "height": 86 },
      "data": {
        "label": "Read Temperature",
        "sensorId": "uuid-of-the-sensor"
      }
    },
    {
      "id": "threshold-node-1",
      "type": "threshold-check",
      "position": { "x": 360, "y": 120 },
      "data": {
        "label": "Check Threshold",
        "minThreshold": 0,
        "maxThreshold": 30,
        "mode": "between"
      }
    },
    {
      "id": "alert-node-1",
      "type": "alert-trigger",
      "position": { "x": 640, "y": 120 },
      "data": {
        "label": "Trigger Alert",
        "severity": "warning",
        "type": "threshold_violation",
        "message": "Temperature exceeded max threshold",
        "stationId": "uuid-of-the-station"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "sensor-node-1",
      "sourcePort": "value",
      "target": "threshold-node-1",
      "targetPort": "value"
    },
    {
      "id": "edge-2",
      "source": "threshold-node-1",
      "sourcePort": "breach",
      "target": "alert-node-1",
      "targetPort": "trigger"
    }
  ]
}
```

The `sourcePort` / `targetPort` fields are what `filterDecisionEdges` uses to implement branching — only edges whose `sourcePort` matches the output's `branch` value are followed.

---

## Key Architectural Decisions

| Decision | Why |
|----------|-----|
| **JointJS for the canvas** | Provides a production-grade graph model with ports, routing, events, and serialization — far more capable than building an SVG canvas from scratch |
| **`node.set("workflow", {...})` custom metadata** | Keeps workflow logic decoupled from JointJS internals — the graph model stores display data, the `workflow` property stores execution data |
| **Serializer/Deserializer pair in `engine/`** | Clean separation: JointJS cells → plain JSON (serialize) and plain JSON → JointJS cells (deserialize). The backend never sees JointJS objects |
| **`useJointGraph` + `useWorkflowEditor` hook composition** | `useJointGraph` owns the imperative JointJS API; `useWorkflowEditor` adds the async execution and file I/O layer. `BuilderPage` stays declarative |
| **Autosave to localStorage** | Prevents loss if the backend is down or the user closes the tab — the draft is always restored on next open |
| **BFS instead of recursive DFS** | Avoids stack overflows on large graphs; handles disconnected subgraphs naturally; nodes only execute after all their predecessors have run |
| **`branch` field convention** | Any handler can return `{ branch: "some-port-id" }` to control routing. The runner is generic — it doesn't know about "pass"/"breach" specifically; it just matches edge `sourcePort` to `branch` |
| **Handler classes injected with real services** | Industrial handlers (`alert-trigger`, `station-control`, etc.) need DB access and MQTT clients. Plain classes receive these in their constructor — keeps them testable without full NestJS DI complexity |
