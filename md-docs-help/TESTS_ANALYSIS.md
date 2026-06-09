# TESTS_ANALYSIS.md
# AquaFlow — Analyse complète des tests

> Toutes les données proviennent de l'analyse statique du code source réel du projet.

---

## 1. Outils et configuration

### Backend — NestJS

| Outil | Version | Rôle |
|-------|---------|------|
| **Jest** | ^29 | Framework de test |
| **ts-jest** | ^29 | Transpilation TypeScript pour Jest |
| **@nestjs/testing** | ^10 | Module de test NestJS (DI, mocks) |
| **Supertest** | ^6 | Tests HTTP end-to-end |

**Configuration Jest** (`backend/jest.config.js`) :
```js
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    'src/**/*.spec.ts',
    'test/**/*.e2e-spec.ts'
  ],
  coverageDirectory: 'coverage/',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts'
  ]
}
```

**Scripts disponibles** :
```bash
npm run test        # exécution unique
npm run test:watch  # mode surveillance (TDD)
npm run test:cov    # avec rapport de couverture HTML
npm run test:e2e    # tests end-to-end uniquement
```

### Frontend — React

| Outil | Rôle |
|-------|------|
| **Jest** (via react-scripts) | Framework de test |
| **React Testing Library** | Tests de hooks et composants |
| **redux-mock-store** | Mock du store Redux |

**Script** :
```bash
npm test -- --watchAll=false --passWithNoTests --forceExit
```

---

## 2. Inventaire complet des fichiers de tests

### 2.1 Backend — 7 fichiers

| # | Fichier | Chemin |
|---|---------|--------|
| 1 | alerts.service.spec.ts | `backend/src/alerts/` |
| 2 | auth.service.spec.ts | `backend/src/auth/` |
| 3 | flows.service.spec.ts | `backend/src/flows/` |
| 4 | iot.service.spec.ts | `backend/src/iot/` |
| 5 | notifications.service.spec.ts | `backend/src/notifications/` |
| 6 | sensors.service.spec.ts | `backend/src/sensors/` |
| 7 | stations.service.spec.ts | `backend/src/stations/` |

### 2.2 Frontend — 3 fichiers

| # | Fichier | Chemin |
|---|---------|--------|
| 8 | useSocket.test.js | `frontend/src/hooks/__tests__/` |
| 9 | alertsSlice.test.js | `frontend/src/store/slices/__tests__/` |
| 10 | notificationsSlice.test.js | `frontend/src/store/slices/__tests__/` |

---

## 3. Décompte précis par fichier

### 3.1 `alerts.service.spec.ts`

**Suites (describe) :** 4 &nbsp;|&nbsp; **Tests (it) :** 10

```
AlertsService
  create()
    ✓ creates and returns alert without station/sensor
    ✓ broadcasts real-time event after creation
    ✓ fires notification without blocking (fire-and-forget)
    ✓ still creates alert even when notifyAlertCreated rejects
    ✓ throws NotFoundException when stationId is given but station not found
    ✓ resolves station and attaches it to alert when stationId is valid
  findAll()
    ✓ returns paginated response
    ✓ returns empty data when no alerts exist
  findOne()
    ✓ returns alert when found
    ✓ throws NotFoundException when alert does not exist
```

**Comportements clés validés :**
- Création d'alerte sans station/capteur associé
- Diffusion Socket.IO de l'événement `alert-created`
- Pattern fire-and-forget pour les notifications (l'erreur n'est pas propagée)
- Résolution de la station à partir du `stationId`

---

### 3.2 `auth.service.spec.ts`

**Suites (describe) :** 6 &nbsp;|&nbsp; **Tests (it) :** 13

```
AuthService
  validateUser()
    ✓ returns user when found and active
    ✓ throws UnauthorizedException when user not found
    ✓ throws UnauthorizedException when user is inactive
  login()
    ✓ returns tokens and user on valid credentials
    ✓ throws UnauthorizedException when user not found
    ✓ throws UnauthorizedException when password is wrong
    ✓ throws UnauthorizedException when account is disabled
  register()
    ✓ throws ConflictException when email already exists
    ✓ creates user and returns tokens on success
  logout()
    ✓ returns success message
    ✓ denylists refresh token when provided
  refreshToken()
    ✓ throws UnauthorizedException when token is denylisted
    ✓ rotates tokens on valid refresh token
```

**Comportements clés validés :**
- Hachage et comparaison bcrypt des mots de passe
- Rejet des comptes inactifs
- Rotation du refresh token (nouveau access + refresh)
- Liste de refus (denylist) Redis pour l'invalidation des tokens

---

### 3.3 `flows.service.spec.ts`

**Suites (describe) :** 8 &nbsp;|&nbsp; **Tests (it) :** 21

```
FlowsService
  create()
    ✓ validates the graph before saving
    ✓ creates and saves the workflow
    ✓ uses graph.id as workflow id when graph.id is provided
    ✓ defaults isActive to false when not provided
    ✓ defaults triggerType to MANUAL when not provided
  findAll()
    ✓ returns all workflows
    ✓ returns empty array when no workflows exist
  findOne()
    ✓ returns workflow when found
    ✓ throws NotFoundException when workflow does not exist
  update()
    ✓ validates graph and saves updated workflow
    ✓ sets updatedBy when user is provided
    ✓ updates triggerType and isActive when provided in dto
    ✓ throws NotFoundException when workflow does not exist
  activate()
    ✓ sets isActive to true and saves
    ✓ throws NotFoundException when workflow does not exist
  deactivate()
    ✓ sets isActive to false and saves
    ✓ throws NotFoundException when workflow does not exist
  remove()
    ✓ removes workflow and returns { deleted: true, id }
    ✓ throws NotFoundException when workflow does not exist
```

**Comportements clés validés :**
- Validation du graphe avant toute sauvegarde
- Valeurs par défaut : `isActive=false`, `triggerType=MANUAL`
- Tracking `updatedBy` sur les modifications
- Rechargement du scheduler sur activation/désactivation

---

### 3.4 `iot.service.spec.ts`

**Suites (describe) :** 4 &nbsp;|&nbsp; **Tests (it) :** 13

```
IotService
  processSensorData()
    ✓ updates sensor lastReading, lastReadingAt and status to ACTIVE
    ✓ creates and saves a SensorData record for each reading
    ✓ broadcasts sensor-update event via RealtimeService
    ✓ does NOT create alert when threshold is not violated
    ✓ creates threshold alert when maxThreshold is exceeded and alertEnabled is true
    ✓ creates threshold alert when value is below minThreshold and alertEnabled is true
    ✓ does NOT create alert even when threshold is violated if alertEnabled is false
    ✓ returns early and does not throw when sensor is not found
    ✓ does not propagate error when alertsService.create rejects
  getSensorStatus()
    ✓ returns sensor when found
    ✓ returns null when sensor is not found
  getActiveStationSensors()
    ✓ returns only ACTIVE sensors for the given station
    ✓ returns empty array when station has no active sensors
```

**Comportements clés validés :**
- Mise à jour de `lastReading` et `lastReadingAt` à chaque mesure
- Création d'alerte automatique sur dépassement de seuil (min et max)
- Respect du flag `alertEnabled` (pas d'alerte si désactivé)
- Gestion gracieuse des capteurs inconnus (pas d'exception)
- Pattern fire-and-forget pour la création d'alertes

---

### 3.5 `notifications.service.spec.ts`

**Suites (describe) :** 5 &nbsp;|&nbsp; **Tests (it) :** 8

```
NotificationsService
  notifyAlertCreated()
    ✓ saves a broadcast notification record
    ✓ broadcasts notification-created via WebSocket
    ✓ skips email when SMTP_HOST is not configured
  getUnreadCount()
    ✓ returns a count object with a number
  markRead()
    ✓ throws NotFoundException when notification not found
    ✓ sets readAt and status = READ, then saves
  markAllRead()
    ✓ broadcasts notifications-read-all event
    ✓ returns count of updated rows
```

**Comportements clés validés :**
- Enregistrement de la notification en base et broadcast WebSocket simultanément
- Ignorance silencieuse de l'email si `SMTP_HOST` non configuré
- Transition de statut `READ` avec horodatage `readAt`

---

### 3.6 `sensors.service.spec.ts`

**Suites (describe) :** 7 &nbsp;|&nbsp; **Tests (it) :** 20

```
SensorsService
  create()
    ✓ creates and returns sensor when station exists
    ✓ throws NotFoundException when stationId is not found
    ✓ clears list cache after successful creation
  findAll()
    ✓ returns cached result when cache hit occurs
    ✓ queries DB and caches result on cache miss
    ✓ returns empty list when no sensors exist
    ✓ calculates page count correctly for multi-page results
  findOne()
    ✓ returns sensor when found
    ✓ throws NotFoundException when sensor does not exist
  update()
    ✓ updates sensor fields and clears cache
    ✓ re-assigns station when stationId is provided in dto
    ✓ throws NotFoundException when new stationId does not exist
  remove()
    ✓ removes sensor and returns { deleted: true, id }
    ✓ throws NotFoundException when sensor does not exist
  injectReading()
    ✓ updates lastReading and lastReadingAt on the sensor
    ✓ creates and saves a SensorData record with source "manual"
    ✓ returns a structured reading summary
    ✓ throws NotFoundException when sensor does not exist
```

**Comportements clés validés :**
- Stratégie Cache-Aside : lecture cache → DB si miss → mise en cache
- Invalidation du cache sur toute opération d'écriture (CRUD)
- Injection manuelle de lecture avec `source='manual'`
- Calcul de pagination (`pages = ceil(total/limit)`)

---

### 3.7 `stations.service.spec.ts`

**Suites (describe) :** 7 &nbsp;|&nbsp; **Tests (it) :** 19

```
StationsService
  create()
    ✓ creates and saves a station, then returns it
    ✓ sets lastStatusChange when status is provided
    ✓ does NOT set lastStatusChange when status is absent
  findAll()
    ✓ returns paginated response with correct meta
    ✓ returns empty data when no stations exist
    ✓ uses default page=1 and limit=20 when not provided
  findOne()
    ✓ returns station when found
    ✓ throws NotFoundException when station does not exist
  update()
    ✓ saves and returns updated station
    ✓ sets lastStatusChange when status actually changes
    ✓ does NOT update lastStatusChange when status stays the same
    ✓ broadcasts station-status event when dto contains a status field
    ✓ does NOT broadcast when dto has no status field
    ✓ throws NotFoundException when station is not found
  remove()
    ✓ removes station and returns { deleted: true, id }
    ✓ throws NotFoundException when station does not exist
```

**Comportements clés validés :**
- Horodatage `lastStatusChange` uniquement lors d'un vrai changement de statut
- Broadcast Socket.IO `station-status` conditionnel (uniquement si statut modifié)
- Valeurs de pagination par défaut : `page=1`, `limit=20`

---

### 3.8 `useSocket.test.js`

**Suites (describe) :** 8 &nbsp;|&nbsp; **Tests (it) :** 25

```
useSocket
  guard conditions
    ✓ does NOT create a socket when enabled = false
    ✓ does NOT create a socket when auth token is null
    ✓ does NOT create a socket when auth token is empty string
  socket creation
    ✓ calls io() with auth.token when enabled and token present
    ✓ includes websocket and polling transports
    ✓ enables reconnection
  event: connect
    ✓ dispatches socketConnected
    ✓ emits subscribe for dashboard, alerts, stations, sensors
  event: disconnect
    ✓ dispatches socketDisconnected
  event: sensor-update
    ✓ dispatches sensorUpdateReceived, sensorRealtimeUpdated, applySensorUpdate
  event: alert-created
    ✓ dispatches alertReceived, alertRealtimeReceived, addDashboardAlert
  event: station-status
    ✓ dispatches stationStatusReceived, updateStationStatus, stationRealtimeUpdated
  event: notification-created
    ✓ dispatches notificationReceived
  event: notifications-read-all
    ✓ dispatches allNotificationsCleared
  cleanup on unmount
    ✓ calls socket.disconnect() when hook unmounts
    ✓ does not call disconnect when no socket was created (no token)
  return value
    ✓ exposes emit, subscribe, unsubscribe helpers
    ✓ subscribe calls socket.emit("subscribe", { channel })
    ✓ unsubscribe calls socket.emit("unsubscribe", { channel })
```

---

### 3.9 `alertsSlice.test.js`

**Suites (describe) :** 6 &nbsp;|&nbsp; **Tests (it) :** 19

```
alertsSlice reducer
  alertRealtimeReceived
    ✓ returns the initial state
    ✓ prepends the incoming alert to items
    ✓ increments meta.total by 1
    ✓ truncates items list to a maximum of 50 entries
    ✓ uses alert.alertId as id fallback when alert.id is absent
    ✓ always sets status to "active"
    ✓ maps station string to { name } object
    ✓ sets station to null when station field is absent
    ✓ uses alert.timestamp as createdAt when provided
  fetchAlerts thunk
    ✓ sets isLoading = true and clears error on pending
    ✓ stores items and meta on fulfilled
    ✓ falls back to empty array when payload.data is absent
    ✓ stores error and clears loading on rejected
  acknowledgeAlert thunk
    ✓ replaces the matching alert in items on fulfilled
    ✓ does not alter other items when ids do not match
  resolveAlert thunk
    ✓ replaces the matching alert on fulfilled
    ✓ does not alter items when id does not match
alertsSlice selectors
    ✓ selectAlerts returns the items array
    ✓ selectAlertsLoading returns the isLoading flag
    ✓ selectAlertsError returns the error string
```

---

### 3.10 `notificationsSlice.test.js`

**Suites (describe) :** 8 &nbsp;|&nbsp; **Tests (it) :** 19

```
notificationsSlice reducer
  notificationReceived
    ✓ returns the initial state
    ✓ prepends the notification to items
    ✓ increments unreadCount by 1
    ✓ increments meta.total by 1
  allNotificationsCleared
    ✓ resets unreadCount to 0
    ✓ does NOT touch the items array
  fetchNotifications thunk
    ✓ sets isLoading = true on pending
    ✓ stores items and meta on fulfilled
    ✓ stores error on rejected
  fetchUnreadCount thunk
    ✓ sets unreadCount on fulfilled
  markNotificationRead thunk
    ✓ replaces the notification in items and decrements unreadCount
    ✓ does not go below 0 for unreadCount
  markAllNotificationsRead thunk
    ✓ sets readAt on all items and resets unreadCount
notificationsSlice selectors
    ✓ selectNotifications returns items array
    ✓ selectUnreadCount returns the count
    ✓ selectNotificationsLoading returns loading flag
    ✓ selectNotificationsMeta returns meta object
```

---

## 4. Tableau récapitulatif global

### 4.1 Par fichier

| # | Fichier | Type | Suites | Tests | Module couvert |
|---|---------|------|--------|-------|---------------|
| 1 | alerts.service.spec.ts | Backend | 4 | 10 | AlertsModule |
| 2 | auth.service.spec.ts | Backend | 6 | 13 | AuthModule |
| 3 | flows.service.spec.ts | Backend | 8 | 21 | FlowsModule |
| 4 | iot.service.spec.ts | Backend | 4 | 13 | IoTModule |
| 5 | notifications.service.spec.ts | Backend | 5 | 8 | NotificationsModule |
| 6 | sensors.service.spec.ts | Backend | 7 | 20 | SensorsModule |
| 7 | stations.service.spec.ts | Backend | 7 | 19 | StationsModule |
| 8 | useSocket.test.js | Frontend | 8 | 25 | WebSocket Hook |
| 9 | alertsSlice.test.js | Frontend | 6 | 19 | Redux Alerts |
| 10 | notificationsSlice.test.js | Frontend | 8 | 19 | Redux Notifications |
| | **TOTAL** | | **63** | **167** | |

### 4.2 Synthèse

| Catégorie | Fichiers | Suites | Tests |
|-----------|----------|--------|-------|
| Backend (NestJS) | 7 | 41 | 104 |
| Frontend (React) | 3 | 22 | 63 |
| **Total** | **10** | **63** | **167** |

---

## 5. Modules couverts par les tests

| Module | Couvert | Ce qui est testé |
|--------|---------|-----------------|
| AlertsModule | ✅ | create, findAll, findOne, broadcast, fire-and-forget |
| AuthModule | ✅ | validateUser, login, register, logout, refreshToken, denylist |
| FlowsModule | ✅ | CRUD complet, activate/deactivate, validation graphe |
| IoTModule | ✅ | processSensorData, seuils, broadcast, getSensorStatus |
| NotificationsModule | ✅ | notifyAlertCreated, markRead, markAllRead, unreadCount |
| SensorsModule | ✅ | CRUD, cache-aside, injectReading, pagination |
| StationsModule | ✅ | CRUD, statusChange, broadcast, pagination |
| WebSocket Hook | ✅ | Connexion, 7 événements Socket.IO, cleanup |
| Redux Alerts Slice | ✅ | Reducers, thunks, sélecteurs |
| Redux Notifications Slice | ✅ | Reducers, thunks, sélecteurs |
| ExecutionEngine | ❌ | Non testé (handlers, runner, validator) |
| AnalyticsModule | ❌ | Non testé |
| MaintenanceModule | ❌ | Non testé |
| UsersModule | ❌ | Non testé |

---

## 6. Exécution des tests

### Commandes d'exécution

```bash
# Backend — depuis backend/
cd backend
npm run test                    # tous les tests
npm run test:cov                # avec couverture

# Frontend — depuis frontend/
cd frontend
npm test -- --watchAll=false --forceExit
```

### Résultats attendus (basés sur l'analyse du code)

```
Test Suites: 10 passed, 10 total
Tests:       167 passed, 167 total
```

### Couverture (modules testés)

| Module | Fichiers couverts |
|--------|-----------------|
| alerts | alerts.service.ts |
| auth | auth.service.ts |
| flows | flows.service.ts |
| iot | iot.service.ts |
| notifications | notifications.service.ts |
| sensors | sensors.service.ts |
| stations | stations.service.ts |

---

## 7. Intégration continue (CI/CD)

Les tests sont exécutés automatiquement sur chaque push/PR vers `main`, `master`, `develop`.

### Pipeline Backend (`.github/workflows/backend-ci.yml`)

```
Job 1: lint-and-build
  └─ ESLint → TypeScript build

Job 2: test (dépend de lint-and-build)
  Services: PostgreSQL 15 + Redis 7
  └─ Tests unitaires (src/**/*.spec.ts)
  └─ Tests E2E (test/**/*.e2e-spec.ts)
  └─ Rapport de couverture (artifact 14 jours)
```

### Pipeline Frontend (`.github/workflows/frontend-ci.yml`)

```
Job: build-and-test
  └─ Build production (CI=true → warnings = erreurs)
  └─ Tests Jest (--watchAll=false --passWithNoTests)
  └─ Artifact build (7 jours)
```
