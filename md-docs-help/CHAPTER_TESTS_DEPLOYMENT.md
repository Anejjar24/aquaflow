# Chapitre 5 — Tests et Validation
# Chapitre 6 — Déploiement

---

# CHAPITRE 5 — TESTS ET VALIDATION

## 5.1 Stratégie de tests

La stratégie de tests adoptée pour AquaFlow suit une approche en trois niveaux complémentaires :

- **Tests unitaires** : chaque service backend et chaque slice Redux frontend est testé de manière isolée, avec injection de dépendances mockées.
- **Tests d'intégration** : les workflows CI/CD GitHub Actions exécutent les tests avec de vrais services PostgreSQL et Redis via des conteneurs Docker.
- **Tests manuels** : validation des scénarios fonctionnels complets via l'interface web et Postman.

| Niveau | Outil | Périmètre |
|--------|-------|-----------|
| Unitaire Backend | Jest + ts-jest | 7 services, 106 cas de test |
| Unitaire Frontend | Jest + React Testing Library | 3 fichiers, 58 cas de test |
| Intégration | GitHub Actions + Docker services | PostgreSQL 15, Redis 7 |
| Manuel | Navigateur + Postman | Scénarios fonctionnels complets |

---

## 5.2 Tests unitaires — Backend

### 5.2.1 Configuration Jest

```js
// backend/jest.config.js
{
  testMatch: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
  transform: { ts-jest },
  coverageDirectory: "coverage/",
  exclude: ["*.module.ts", "main.ts"]
}
```

Commandes disponibles :
```bash
npm run test          # exécution unique
npm run test:watch    # mode surveillance
npm run test:cov      # avec rapport de couverture
npm run test:e2e      # tests end-to-end
```

### 5.2.2 Fichiers de tests et cas couverts

#### `alerts.service.spec.ts` — 15 cas de test

| Suite | Cas testés |
|-------|-----------|
| create() | Création avec station, sans station, broadcast temps réel, tolérance erreur notification |
| findAll() | Liste paginée, filtres actifs |
| findOne() | Alerte existante, NotFoundException |
| acknowledge / resolve | Transition statut, mise à jour horodatage |

Comportements vérifiés :
- Création d'alerte sans station associée
- Diffusion Socket.IO de l'événement `alert-created`
- Gestion fire-and-forget pour les notifications (erreur non propagée)

---

#### `auth.service.spec.ts` — 18 cas de test

| Suite | Cas testés |
|-------|-----------|
| validateUser() | Identifiants valides, mot de passe incorrect, utilisateur inactif |
| login() | JWT access + refresh générés, profil retourné, utilisateur introuvable |
| register() | Inscription réussie, email déjà utilisé |
| logout() | Jeton inscrit en liste de refus (Redis) |
| refreshToken() | Nouveau jeton généré, jeton révoqué rejeté |

Comportements vérifiés :
- Hachage et comparaison bcrypt des mots de passe
- Rotation du refresh token
- Liste de refus (denylist) basée sur Redis
- Rejet des comptes inactifs

---

#### `flows.service.spec.ts` — 21 cas de test

| Suite | Cas testés |
|-------|-----------|
| create() | Création avec UUID auto, triggerType par défaut MANUAL, graphe valide, isActive=false |
| findAll() | Liste ordonnée par createdAt DESC |
| findOne() | Workflow existant, NotFoundException |
| update() | Mise à jour nom/graphe/trigger, tracking updatedBy |
| activate() | isActive=true + rechargement scheduler |
| deactivate() | isActive=false + rechargement scheduler |
| remove() | Suppression, NotFoundException |

---

#### `iot.service.spec.ts` — 17 cas de test

| Suite | Cas testés |
|-------|-----------|
| processSensorData() | Mise à jour valeur, dépassement seuil min, dépassement seuil max, capteur inconnu, erreur silencieuse |
| getSensorStatus() | En ligne, hors ligne (timeout 5 min) |
| getActiveStationSensors() | Capteurs actifs d'une station |

Comportements vérifiés :
- Mise à jour `lastReading` et `lastReadingAt` du capteur
- Création d'alerte automatique sur dépassement de seuil
- Broadcast Socket.IO de l'événement `sensor-update`
- Gestion gracieuse des capteurs inconnus

---

#### `notifications.service.spec.ts` — 8 cas de test

| Suite | Cas testés |
|-------|-----------|
| notifyAlertCreated() | Notification enregistrée + broadcast WS, email ignoré si SMTP non configuré |
| getUnreadCount() | Compteur par userId |
| markRead() | Statut → READ, décrémentation unreadCount |
| markAllRead() | Toutes notifications → DELIVERED |

---

#### `sensors.service.spec.ts` — 19 cas de test

| Suite | Cas testés |
|-------|-----------|
| create() | Avec station, sans station |
| findAll() | Pagination, filtres type/station, résultat mis en cache |
| findOne() | Existant, NotFoundException |
| update() | Réassignation station, invalidation cache |
| remove() | Suppression avec invalidation cache |
| injectReading() | Injection manuelle (source='manual'), valeur hors seuil |

---

#### `stations.service.spec.ts` — 15 cas de test

| Suite | Cas testés |
|-------|-----------|
| create() | Station créée avec statut initial |
| findAll() | Pagination (défaut page=1, limit=20), cache |
| findOne() | Existante, NotFoundException |
| update() | Transition statut (lastStatusChange), broadcast `station-status` |
| remove() | Suppression |

---

### 5.2.3 Récapitulatif backend

| Fichier | Suites | Cas de test |
|---------|--------|-------------|
| alerts.service.spec.ts | 4 | 15 |
| auth.service.spec.ts | 5 | 18 |
| flows.service.spec.ts | 7 | 21 |
| iot.service.spec.ts | 3 | 17 |
| notifications.service.spec.ts | 4 | 8 |
| sensors.service.spec.ts | 7 | 19 |
| stations.service.spec.ts | 7 | 15 |
| **Total** | **37** | **113** |

---

## 5.3 Tests unitaires — Frontend

### 5.3.1 Configuration

Les tests frontend utilisent Jest et React Testing Library, configurés via `react-scripts`.

```bash
npm test -- --watchAll=false --passWithNoTests --forceExit
```

### 5.3.2 Fichiers de tests

#### `useSocket.test.js` — 22 cas de test

Teste le hook personnalisé `useSocket` qui gère la connexion Socket.IO temps réel.

| Suite | Cas testés |
|-------|-----------|
| Conditions de garde | Flag enabled=false, token absent |
| Création socket | Options: auth token, reconnection=true, transports=[websocket, polling] |
| Gestionnaires d'événements | connect, disconnect, sensor-update, alert-created, station-status, notification-created, notifications-read-all |
| Nettoyage | Déconnexion à l'unmount |

Événements Socket.IO couverts et actions Redux déclenchées :

| Événement | Action Redux dispatchée |
|-----------|------------------------|
| `connect` | socketConnected, subscribe(dashboard/alerts/stations/sensors) |
| `disconnect` | socketDisconnected |
| `sensor-update` | sensorUpdateReceived, sensorRealtimeUpdated, applySensorUpdate |
| `alert-created` | alertReceived, alertRealtimeReceived, addDashboardAlert |
| `station-status` | stationStatusReceived, updateStationStatus, stationRealtimeUpdated |
| `notification-created` | notificationReceived |
| `notifications-read-all` | allNotificationsCleared |

---

#### `alertsSlice.test.js` — 19 cas de test

| Suite | Cas testés |
|-------|-----------|
| alertRealtimeReceived | Prepend (plus récent en tête), troncature à 50 éléments, statut forcé 'active', fallback alertId, mapping station string → {name} |
| fetchAlerts (thunk) | Pagination, pages calculées, état loading |
| acknowledgeAlert | Transition statut |
| resolveAlert | Transition statut |
| Sélecteurs | selectAlerts, selectAlertsLoading, selectAlertsError |

---

#### `notificationsSlice.test.js` — 17 cas de test

| Suite | Cas testés |
|-------|-----------|
| notificationReceived | Prepend, incrémentation unreadCount |
| allNotificationsCleared | Reset unreadCount=0, items inchangés |
| fetchNotifications | Chargement, pagination |
| fetchUnreadCount | Compteur correct |
| markNotificationRead | readAt défini, unreadCount décrémenté (jamais < 0) |
| markAllNotificationsRead | readAt sur toutes les notifications |
| Sélecteurs | selectNotifications, selectUnreadCount, selectNotificationsLoading, selectNotificationsMeta |

---

### 5.3.3 Récapitulatif frontend

| Fichier | Suites | Cas de test |
|---------|--------|-------------|
| useSocket.test.js | 6 | 22 |
| alertsSlice.test.js | 5 | 19 |
| notificationsSlice.test.js | 7 | 17 |
| **Total** | **18** | **58** |

---

## 5.4 Tests manuels

### 5.4.1 Tableau des cas de test fonctionnels

| ID | Module | Scénario | Résultat attendu | Statut |
|----|--------|----------|-----------------|--------|
| T01 | Auth | Login avec identifiants valides | JWT retourné, dashboard affiché | ✅ |
| T02 | Auth | Login avec mot de passe erroné | Erreur 401 affichée | ✅ |
| T03 | Auth | Accès page protégée sans token | Redirection vers login | ✅ |
| T04 | Workflow Builder | Créer un workflow simple (input → sensor-read → output) | Exécution COMPLETED | ✅ |
| T05 | Workflow Builder | Workflow avec cycle (A→B→A) | Erreur de validation cycle détecté | ✅ |
| T06 | Workflow Builder | Décision avec branches true/false | Bonne branche suivie | ✅ |
| T07 | Workflow Builder | Autosave localStorage | Reprise après rechargement page | ✅ |
| T08 | IoT | Capteur publie valeur > seuil max | Alerte créée + notification temps réel | ✅ |
| T09 | Alertes | Acquitter une alerte | Statut → acknowledged | ✅ |
| T10 | Alertes | Résoudre une alerte | Statut → resolved | ✅ |
| T11 | Temps réel | Connexion WebSocket | Événements reçus en temps réel | ✅ |
| T12 | Maintenance | Créer un ordre, assigner technicien | Notification envoyée au technicien | ✅ |
| T13 | Dashboard | Chargement KPIs | Données agrégées affichées | ✅ |
| T14 | Health | GET /api/health | `{"status":"ok"}` retourné | ✅ |

---

## 5.5 Bilan des tests

| Catégorie | Fichiers | Cas de test | Couverture |
|-----------|----------|-------------|-----------|
| Tests unitaires backend | 7 | 113 | Services métier principaux |
| Tests unitaires frontend | 3 | 58 | Redux slices + WebSocket hook |
| Tests manuels | — | 14 scénarios | Fonctionnalités critiques |
| **Total** | **10** | **185** | |

---

---

# CHAPITRE 6 — DÉPLOIEMENT

## 6.1 Architecture de déploiement

AquaFlow est entièrement conteneurisé via **Docker Compose**. L'infrastructure repose sur 5 services orchestrés, tous reliés via un réseau bridge interne `aquaflow-network`.

```
┌──────────────────────────────────────────┐
│              Docker Host                  │
│                                           │
│  [nginx:80] ← [NestJS:3001]              │
│       ↓            ↓    ↓    ↓           │
│  [React SPA]  [PG:5432] [Redis:6379]     │
│               [Mosquitto:1883/9001]       │
└──────────────────────────────────────────┘
```

---

## 6.2 Services Docker

| Service | Image | Port interne | Port exposé (dev) | Port exposé (prod) |
|---------|-------|-------------|-------------------|-------------------|
| frontend | nginx:1.25-alpine | 80 | 3000:80 | 80:80 |
| backend | node:20-alpine | 3001 | 3001:3001 | interne uniquement |
| postgres | postgres:15-alpine | 5432 | 5432:5432 | interne uniquement |
| redis | redis:7-alpine | 6379 | 6379:6379 | interne uniquement |
| mosquitto | eclipse-mosquitto:2 | 1883, 9001 | 1883, 9001 | 9001 seulement |

---

## 6.3 Images Docker (builds multi-étapes)

### Backend — `backend/Dockerfile`

```dockerfile
# Étape 1 — Build
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm ci --legacy-peer-deps
RUN npm run build

# Étape 2 — Production
FROM node:20-alpine
RUN addgroup aquaflow && adduser -S aquaflow -G aquaflow  # utilisateur non-root
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health
CMD ["node", "dist/main"]
```

### Frontend — `frontend/Dockerfile`

```dockerfile
# Étape 1 — Build React
FROM node:20-alpine AS builder
ARG REACT_APP_API_URL=http://localhost:3001/api
ARG REACT_APP_WS_URL=http://localhost:3001
RUN npm ci --legacy-peer-deps && npm run build

# Étape 2 — Serveur nginx
FROM nginx:1.25-alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/index.html
CMD ["nginx", "-g", "daemon off;"]
```

### Configuration nginx (`frontend/nginx.conf`)
- Fallback SPA : `try_files $uri $uri/ /index.html`
- Assets statiques (.js, .css) : expiration 1 an + `immutable`
- `index.html` : `no-cache, no-store` (toujours la dernière version)
- En-têtes de sécurité : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- Compression gzip activée

---

## 6.4 Environnements

### 6.4.1 Développement (`docker-compose.yml`)

- Tous les ports exposés sur la machine hôte
- Mosquitto : `allow_anonymous true`
- Redis : pas de mot de passe
- Variables JWT : valeurs par défaut fournies
- Restart policy : `unless-stopped`

### 6.4.2 Production (`docker-compose.prod.yml`)

Différences clés par rapport au développement :

| Aspect | Développement | Production |
|--------|--------------|-----------|
| Ports PostgreSQL | Exposé :5432 | **Non exposé** (interne) |
| Ports Redis | Exposé :6379 | **Non exposé** (interne) |
| Port backend | Exposé :3001 | **Non exposé** (interne) |
| Port MQTT :1883 | Exposé | **Non exposé** (interne) |
| Redis | Sans mot de passe | `--requirepass ${REDIS_PASSWORD}` |
| Redis persistence | Non | `--appendonly yes` |
| Redis mémoire | Illimitée | `--maxmemory 96mb --maxmemory-policy allkeys-lru` |
| Mosquitto | `allow_anonymous true` | `allow_anonymous false` + `password_file` |
| Logs Docker | Par défaut | json-file, max-size: 20m, max-file: 5 |
| Ressources | Sans limite | CPU et mémoire limités par service |
| Restart | unless-stopped | **always** |
| Réseau | bridge | bridge + subnet fixe `172.20.0.0/16` |

**Limites de ressources production :**

| Service | CPU max | Mémoire max |
|---------|---------|------------|
| backend | 0.50 core | 512 Mo |
| postgres | 0.50 core | 512 Mo |
| redis | 0.20 core | 128 Mo |
| mosquitto | 0.10 core | 64 Mo |
| frontend | 0.20 core | 128 Mo |

---

## 6.5 Configuration des variables d'environnement

Fichier modèle : `.env.example`

### Variables obligatoires

```bash
# Base de données
POSTGRES_USER=aquaflow
POSTGRES_PASSWORD=<mot_de_passe_fort>
POSTGRES_DB=aquaflow

# Cache
REDIS_PASSWORD=<mot_de_passe_redis>
# Génération : openssl rand -hex 24

# MQTT
MQTT_USERNAME=aquaflow
MQTT_PASSWORD=<mot_de_passe_mqtt>

# JWT
JWT_SECRET=<32_caractères_minimum>
JWT_REFRESH_SECRET=<32_caractères_minimum>
# Génération : openssl rand -hex 32

# URLs
FRONTEND_URL=https://votre-domaine.com
REACT_APP_API_URL=https://votre-domaine.com/api
REACT_APP_WS_URL=https://votre-domaine.com
```

### Variables optionnelles

```bash
# Email (notifications)
SMTP_HOST=          # Laisser vide pour désactiver les emails
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@aquaflow.io
```

---

## 6.6 Procédure de déploiement

### Prérequis
- Docker ≥ 24.0
- Docker Compose ≥ 2.20
- Ports disponibles : 80 (prod) ou 3000/3001 (dev)

### Étapes

```bash
# 1. Cloner le dépôt
git clone <repository-url>
cd pfe-project

# 2. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec les vraies valeurs

# 3. (Production uniquement) Générer le fichier de mots de passe MQTT
docker run --rm eclipse-mosquitto:2 \
  sh -c "mosquitto_passwd -b /dev/stdout $MQTT_USERNAME $MQTT_PASSWORD" \
  > mosquitto/config/passwd

# 4. Lancer tous les services
docker-compose up --build -d                          # développement
docker-compose -f docker-compose.prod.yml up -d      # production

# 5. Initialiser la base de données (premier déploiement)
docker exec aquaflow-backend npm run seed

# 6. Vérifier le déploiement
curl http://localhost:3001/api/health
# Réponse attendue: {"status":"ok","db":{"status":"ok"},"redis":{"status":"ok"}}
```

---

## 6.7 Health Checks

Chaque service dispose d'un healthcheck Docker. Le backend expose un endpoint dédié :

```
GET /api/health
```

**Réponse nominale (HTTP 200) :**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T10:00:00.000Z",
  "uptime": 3600,
  "db": { "status": "ok" },
  "redis": { "status": "ok" }
}
```

**Réponse dégradée (HTTP 503) :**
```json
{
  "status": "degraded",
  "db": { "status": "error" },
  "redis": { "status": "ok" }
}
```

Le frontend dépend du backend (healthcheck), lui-même dépendant de PostgreSQL, Redis et Mosquitto — garantissant un démarrage ordonné des services.

---

## 6.8 Intégration Continue (CI/CD)

Le projet intègre deux pipelines GitHub Actions déclenchés sur les branches `main`, `master` et `develop`.

### Pipeline Backend (`.github/workflows/backend-ci.yml`)

**Déclencheur :** push/PR sur `backend/**`

| Job | Étapes |
|-----|--------|
| **lint-build** | ESLint → Build TypeScript |
| **test** (dépend de lint-build) | Tests unitaires (src/) → Tests E2E (test/) → Rapport de couverture |

Services Docker utilisés pendant les tests :
- PostgreSQL 15 (base `aquaflow_test`)
- Redis 7

### Pipeline Frontend (`.github/workflows/frontend-ci.yml`)

**Déclencheur :** push/PR sur `frontend/**`

| Étape | Commande |
|-------|---------|
| Build production | `npm run build` avec `CI=true` |
| Tests | `npm test -- --watchAll=false --passWithNoTests` |
| Artifact | Build conservé 7 jours |

> `CI=true` traite les warnings React comme des erreurs — garantit la qualité du build.

---

## 6.9 Sécurité du déploiement

| Mesure | Description |
|--------|-------------|
| Utilisateur non-root | Backend s'exécute en tant que `aquaflow:aquaflow` |
| Ports internes | PostgreSQL, Redis, backend non exposés en production |
| Redis authentifié | `--requirepass` obligatoire en production |
| MQTT authentifié | `allow_anonymous false` + fichier passwd en production |
| JWT secrets | Variables d'environnement, jamais en dur dans le code |
| Headers nginx | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Réseau isolé | Tous les services dans `aquaflow-network` (bridge isolé) |
| Logs limités | Rotation automatique (max-size, max-file) |
