# DEPLOYMENT_ANALYSIS.md
# AquaFlow — Analyse complète du déploiement

> Toutes les informations proviennent des fichiers réels du projet.

---

## 1. Vue d'ensemble

AquaFlow est entièrement conteneurisé via **Docker Compose**. L'infrastructure comprend **5 services** orchestrés, deux environnements (développement / production), et un pipeline CI/CD GitHub Actions.

| Élément | Valeur |
|---------|--------|
| Outil d'orchestration | Docker Compose 3.8 |
| Environnements | Développement + Production |
| Nombre de services | 5 |
| Réseau interne | `aquaflow-network` (bridge) |
| Subnet production | `172.20.0.0/16` |
| CI/CD | GitHub Actions (2 pipelines) |

---

## 2. Services Docker

### 2.1 PostgreSQL — Base de données principale

| Propriété | Développement | Production |
|-----------|--------------|-----------|
| Image | `postgres:15-alpine` | `postgres:15-alpine` |
| Port exposé hôte | `5432:5432` | **Non exposé** |
| Port interne | 5432 | 5432 |
| Base de données | `aquaflow` | `aquaflow` |
| Utilisateur | `postgres` | `${POSTGRES_USER}` |
| Mot de passe | `postgres` | `${POSTGRES_PASSWORD}` ← obligatoire |
| Volume | `postgres_data:/var/lib/postgresql/data` | idem |
| Restart | `unless-stopped` | `always` |
| CPU max | — | 0.50 core |
| RAM max | — | 512 Mo |
| RAM réservée | — | 128 Mo |
| Logging | défaut | json-file max-size:10m max-file:3 |

**Health check :**
```yaml
test: ["CMD-SHELL", "pg_isready -U postgres"]
interval: 10s
timeout: 5s
retries: 5
start_period: 30s
```

---

### 2.2 Redis — Cache et gestion des sessions

| Propriété | Développement | Production |
|-----------|--------------|-----------|
| Image | `redis:7-alpine` | `redis:7-alpine` |
| Port exposé hôte | `6379:6379` | **Non exposé** |
| Port interne | 6379 | 6379 |
| Authentification | Aucune | `--requirepass ${REDIS_PASSWORD}` |
| Persistance | Non | `--appendonly yes` |
| Mémoire max | Illimitée | `--maxmemory 96mb` |
| Politique expulsion | — | `allkeys-lru` |
| Volume | `redis_data:/data` | idem |
| Restart | `unless-stopped` | `always` |
| CPU max | — | 0.20 core |
| RAM max | — | 128 Mo |

**Health check :**
```yaml
test: ["CMD", "redis-cli", "ping"]
interval: 10s
timeout: 3s
retries: 5
```

**Usages dans l'application :**
- Cache des réponses API (TTL 5 min, stratégie Cache-Aside)
- Liste de refus des tokens JWT révoqués (denylist)
- Test de santé (health check de l'API)

---

### 2.3 Mosquitto — Broker MQTT

| Propriété | Développement | Production |
|-----------|--------------|-----------|
| Image | `eclipse-mosquitto:2` | `eclipse-mosquitto:2` |
| Port MQTT :1883 | Exposé | **Non exposé** (interne uniquement) |
| Port WebSocket :9001 | Exposé | Exposé (clients navigateurs) |
| Authentification | `allow_anonymous true` | `allow_anonymous false` + passwd |
| Config | `mosquitto.conf` | `mosquitto.prod.conf` |
| Connexions max | Illimitées | 100 |
| Messages en file max | 1000 | 1000 |
| Logs | Tous niveaux | error, warning, notice uniquement |
| Volumes | `mosquitto_data`, `mosquitto_logs` | idem |
| CPU max | — | 0.10 core |
| RAM max | — | 64 Mo |

**Health check :**
```yaml
test: mosquitto_sub -h localhost -t '#' -C 1 -W 3
interval: 30s
timeout: 10s
retries: 3
```

**Topics utilisés par l'application :**
- `sensors/{sensorId}/data` → données capteurs (publish IoT → subscribe NestJS)
- `devices/{deviceId}/commands` → commandes pompes (publish NestJS → subscribe IoT)
- `aquaflow/commands` → commandes génériques (publish NestJS)
- `stations/#` → statut stations

**Génération du fichier passwd (production) :**
```bash
docker run --rm eclipse-mosquitto:2 \
  sh -c "mosquitto_passwd -b /dev/stdout $MQTT_USERNAME $MQTT_PASSWORD" \
  > mosquitto/config/passwd
```

---

### 2.4 NestJS Backend — API et moteur d'exécution

| Propriété | Développement | Production |
|-----------|--------------|-----------|
| Build | `./backend/Dockerfile` (multi-stage) | idem |
| Port exposé hôte | `3001:3001` | **Non exposé** (`expose: 3001`) |
| Port interne | 3001 | 3001 |
| Utilisateur | root | `aquaflow` (non-root) |
| Node.js | 20-alpine | 20-alpine |
| NODE_ENV | production | production |
| Restart | `unless-stopped` | `always` |
| CPU max | — | 0.50 core |
| RAM max | — | 512 Mo |
| Logging | défaut | json-file max-size:20m max-file:5 |
| Dépend de | postgres, redis, mosquitto (healthy) | idem |

**Variables d'environnement :**
```env
NODE_ENV=production
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=${POSTGRES_USER}
DATABASE_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_NAME=${POSTGRES_DB}
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}       # prod uniquement
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_USERNAME=${MQTT_USERNAME}         # prod uniquement
MQTT_PASSWORD=${MQTT_PASSWORD}         # prod uniquement
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
FRONTEND_URL=${FRONTEND_URL}
SMTP_HOST=${SMTP_HOST}                 # optionnel
```

**Health check :**
```yaml
test: wget -qO- http://localhost:3001/api/health && \
      wget -qO- http://localhost:3001/api/health | grep -q '"status":"ok"'
interval: 30s
timeout: 10s
retries: 3
start_period: 40s
```

---

### 2.5 Frontend — React + nginx

| Propriété | Développement | Production |
|-----------|--------------|-----------|
| Build | `./frontend/Dockerfile` (multi-stage) | idem |
| Port exposé hôte | `3000:80` | `80:80` (+ `443:443` si HTTPS) |
| Port interne | 80 | 80 |
| Serveur web | nginx:1.25-alpine | nginx:1.25-alpine |
| Build args | `REACT_APP_API_URL`, `REACT_APP_WS_URL` | depuis `.env.prod` |
| Restart | `unless-stopped` | `always` |
| CPU max | — | 0.20 core |
| RAM max | — | 128 Mo |
| Dépend de | backend (healthy) | idem |

**Configuration nginx (`frontend/nginx.conf`) :**
```nginx
# SPA fallback (React Router)
location / {
    try_files $uri $uri/ /index.html;
}

# Assets statiques hashés → cache 1 an
location ~* \.(js|css|png|jpg|gif|ico|woff2?)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# index.html → jamais mis en cache
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# En-têtes de sécurité
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";

# Compression gzip
gzip on;
gzip_min_length 1024;
```

---

## 3. Images Docker — Builds multi-stages

### 3.1 Backend Dockerfile

```dockerfile
# ── Étape 1 : Build ────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps        # installation reproductible
COPY . .
RUN npm run build                    # compilation TypeScript → dist/

# ── Étape 2 : Production ───────────────────────────
FROM node:20-alpine
WORKDIR /app

# Sécurité : utilisateur non-root
RUN addgroup -S aquaflow && adduser -S aquaflow -G aquaflow

# Uniquement les dépendances de production
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist

USER aquaflow
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health

CMD ["node", "dist/main"]
```

**Avantages du build multi-stage :**
- Image finale sans outils de compilation (devDependencies, TypeScript, ts-node)
- Taille de l'image réduite
- Exécution en utilisateur non-root pour la sécurité

### 3.2 Frontend Dockerfile

```dockerfile
# ── Étape 1 : Build React ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ARG REACT_APP_API_URL=http://localhost:3001/api
ARG REACT_APP_WS_URL=http://localhost:3001
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build                    # génère build/ (HTML, JS, CSS optimisés)

# ── Étape 2 : Serveur nginx ────────────────────────
FROM nginx:1.25-alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost/index.html

CMD ["nginx", "-g", "daemon off;"]
```

**Note importante :** `REACT_APP_API_URL` et `REACT_APP_WS_URL` sont des **build args** — leur valeur est fixée à la compilation de l'image. Changer ces variables en production nécessite une reconstruction de l'image.

---

## 4. Variables d'environnement

### 4.1 Variables obligatoires (`.env.example`)

| Variable | Usage | Exemple de génération |
|----------|-------|----------------------|
| `POSTGRES_PASSWORD` | Mot de passe base de données | Mot de passe fort |
| `REDIS_PASSWORD` | Authentification Redis | `openssl rand -hex 24` |
| `MQTT_USERNAME` | Utilisateur broker MQTT | — |
| `MQTT_PASSWORD` | Mot de passe broker MQTT | — |
| `JWT_SECRET` | Signature tokens d'accès (min 32 chars) | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Signature tokens de renouvellement | `openssl rand -hex 32` |
| `FRONTEND_URL` | CORS autorisé | `https://votre-domaine.com` |
| `REACT_APP_API_URL` | URL API pour le frontend | `https://votre-domaine.com/api` |
| `REACT_APP_WS_URL` | URL WebSocket pour le frontend | `https://votre-domaine.com` |

### 4.2 Variables optionnelles

| Variable | Usage | Comportement si absent |
|----------|-------|----------------------|
| `SMTP_HOST` | Envoi d'emails | Emails désactivés silencieusement |
| `SMTP_PORT` | Port SMTP (défaut: 587) | — |
| `SMTP_USER` | Utilisateur SMTP | — |
| `SMTP_PASS` | Mot de passe SMTP | — |
| `SMTP_FROM` | Adresse expéditeur | — |
| `IMAGE_TAG` | Tag image Docker | `latest` |

---

## 5. Réseau et volumes

### 5.1 Réseau

| Réseau | Type | Subnet (prod) |
|--------|------|---------------|
| `aquaflow-network` | bridge | `172.20.0.0/16` |

Tous les services communiquent via ce réseau interne. En production, seuls les ports 80 (HTTP), 443 (HTTPS) et 9001 (MQTT WebSocket) sont exposés à l'extérieur.

### 5.2 Volumes persistants

| Volume | Service | Contenu |
|--------|---------|---------|
| `postgres_data` | PostgreSQL | Données relationnelles complètes |
| `redis_data` | Redis | Cache + denylist JWT (AOF en prod) |
| `mosquitto_data` | Mosquitto | Messages persistés |
| `mosquitto_logs` | Mosquitto | Fichiers de log |

---

## 6. Ordre de démarrage et dépendances

```
postgres ──────────────┐
                       ▼
redis ─────────────── backend ──── frontend
                       ▲
mosquitto ─────────────┘
```

Docker Compose attend le statut `healthy` de chaque dépendance avant de démarrer le service suivant.

| Service | Attend |
|---------|--------|
| backend | postgres (healthy) + redis (healthy) + mosquitto (healthy) |
| frontend | backend (healthy) |

---

## 7. Pipeline CI/CD GitHub Actions

### 7.1 Backend CI (`.github/workflows/backend-ci.yml`)

**Déclencheurs :**
```yaml
on:
  push:
    branches: [main, master, develop]
    paths: ['backend/**', '.github/workflows/backend-ci.yml']
  pull_request:
    branches: [main, master, develop]
    paths: ['backend/**', '.github/workflows/backend-ci.yml']
```

**Job 1 — `lint-and-build` :**
```
Node.js 20 setup + cache npm
→ npm ci --legacy-peer-deps
→ npm run lint           (ESLint)
→ npm run build          (TypeScript compilation)
```

**Job 2 — `test` (dépend de lint-and-build) :**
```
Services provisionnés automatiquement:
  - postgres:15 (POSTGRES_DB=aquaflow_test, port 5432)
  - redis:7 (port 6379)

Variables d'environnement:
  NODE_ENV=test
  DATABASE_NAME=aquaflow_test
  JWT_SECRET=ci-test-jwt-secret-32-chars-min
  MQTT_BROKER_URL=mqtt://localhost:1883

Étapes:
→ npm ci --legacy-peer-deps
→ Tests unitaires: jest --testPathPattern="src/" --forceExit
→ Tests E2E:       jest --testPathPattern="test/" --forceExit
→ Couverture:      npm run test:cov (continue-on-error: true)
→ Upload artifact: coverage/ (rétention 14 jours)
```

### 7.2 Frontend CI (`.github/workflows/frontend-ci.yml`)

**Déclencheurs :**
```yaml
on:
  push:
    branches: [main, master, develop]
    paths: ['frontend/**', '.github/workflows/frontend-ci.yml']
  pull_request:
    branches: [main, master, develop]
    paths: ['frontend/**', '.github/workflows/frontend-ci.yml']
```

**Job — `build-and-test` :**
```
Node.js 20 setup + cache npm
→ npm ci --legacy-peer-deps
→ Build production (CI=true → warnings = erreurs)
→ Tests Jest (--watchAll=false --passWithNoTests --forceExit)
→ Upload artifact: build/ (rétention 7 jours)
```

**Note :** `CI=true` est crucial — en mode CI, les warnings React dans le code sont traités comme des erreurs, garantissant la qualité du build de production.

---

## 8. Comparaison Développement / Production

| Aspect | Développement | Production |
|--------|--------------|-----------|
| **Fichier** | `docker-compose.yml` | `docker-compose.prod.yml` |
| **PostgreSQL port** | ✅ Exposé :5432 | ❌ Interne uniquement |
| **Redis port** | ✅ Exposé :6379 | ❌ Interne uniquement |
| **Backend port** | ✅ Exposé :3001 | ❌ Interne uniquement |
| **MQTT :1883** | ✅ Exposé | ❌ Interne uniquement |
| **MQTT :9001** | ✅ Exposé | ✅ Exposé (clients WS) |
| **Frontend port** | :3000 | :80 (+ :443 HTTPS) |
| **Redis auth** | Non | Mot de passe obligatoire |
| **Redis persist** | Non | AOF activé |
| **Redis mémoire** | Illimitée | 96 Mo max, LRU |
| **MQTT auth** | anonymous true | anonymous false + passwd |
| **Restart policy** | unless-stopped | always |
| **Limites ressources** | Aucune | CPU + RAM par service |
| **Logs Docker** | Défaut | json-file, rotation auto |
| **Réseau subnet** | Automatique | 172.20.0.0/16 fixe |
| **Utilisateur backend** | root | aquaflow (non-root) |
