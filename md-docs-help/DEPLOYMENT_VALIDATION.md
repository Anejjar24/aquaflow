# DEPLOYMENT_VALIDATION.md
# AquaFlow — Validation du déploiement

> Comment vérifier qu'un déploiement AquaFlow est opérationnel, étape par étape.

---

## 1. Endpoint de santé — Health Check API

### 1.1 Définition

Le backend expose un endpoint dédié `GET /api/health` (sans authentification) qui vérifie simultanément la connectivité PostgreSQL et Redis.

**Implémentation** (`backend/src/app.controller.ts`) :
```typescript
@Get('health')
async health(@Res({ passthrough: true }) res: Response) {
  const [dbOk, redisOk] = await Promise.all([
    this.databaseService.healthCheck(),           // pg_isready
    this.cacheManager.set('__health_check', '1', 3000)  // Redis set TTL 3s
  ]);

  const allOk = dbOk && redisOk;
  if (!allOk) res.status(503);

  return {
    status: allOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),         // secondes depuis démarrage
    db:    { status: dbOk    ? 'ok' : 'error' },
    redis: { status: redisOk ? 'ok' : 'error' }
  };
}
```

### 1.2 Codes de retour

| Code HTTP | Signification |
|-----------|--------------|
| `200 OK` | Tous les services sont opérationnels |
| `503 Service Unavailable` | Au moins un sous-système est en erreur |

### 1.3 Exemples de réponses

**Système sain (200) :**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T10:00:00.000Z",
  "uptime": 3600,
  "db":    { "status": "ok" },
  "redis": { "status": "ok" }
}
```

**Système dégradé (503) — Redis inaccessible :**
```json
{
  "status": "degraded",
  "timestamp": "2026-06-07T10:00:00.000Z",
  "uptime": 120,
  "db":    { "status": "ok" },
  "redis": { "status": "error" }
}
```

### 1.4 Vérification en ligne de commande

```bash
# Vérification simple
curl -s http://localhost:3001/api/health

# Avec code HTTP visible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health

# Avec parsing JSON (Python)
curl -s http://localhost:3001/api/health | python -m json.tool

# Script de vérification automatique
STATUS=$(curl -s http://localhost:3001/api/health | grep -o '"status":"[^"]*"' | head -1)
if echo "$STATUS" | grep -q '"ok"'; then
  echo "✅ Déploiement opérationnel"
else
  echo "❌ Déploiement dégradé : $STATUS"
  exit 1
fi
```

---

## 2. Health Checks Docker

Chaque service Docker dispose d'un health check natif. Docker marque le conteneur `healthy` ou `unhealthy` selon le résultat.

### 2.1 Vérification des statuts

```bash
# Statut de tous les conteneurs
docker-compose ps

# Format tableau détaillé
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Inspecter le health check d'un conteneur spécifique
docker inspect aquaflow-backend --format='{{.State.Health.Status}}'
docker inspect aquaflow-postgres --format='{{.State.Health.Status}}'
docker inspect aquaflow-redis --format='{{.State.Health.Status}}'
```

**Sortie attendue quand tout est opérationnel :**
```
NAME                   STATUS                    PORTS
aquaflow-postgres      Up 5 minutes (healthy)    0.0.0.0:5432->5432/tcp
aquaflow-redis         Up 5 minutes (healthy)    0.0.0.0:6379->6379/tcp
aquaflow-mosquitto     Up 5 minutes (healthy)    0.0.0.0:1883->1883/tcp
aquaflow-backend       Up 4 minutes (healthy)    0.0.0.0:3001->3001/tcp
aquaflow-frontend      Up 3 minutes (healthy)    0.0.0.0:3000->80/tcp
```

### 2.2 Détail des health checks par service

| Service | Commande de test | Intervalle | Délai démarrage |
|---------|-----------------|-----------|-----------------|
| postgres | `pg_isready -U postgres` | 10s | 30s |
| redis | `redis-cli ping` | 10s | — |
| mosquitto | `mosquitto_sub -t '#' -C 1 -W 3` | 30s | — |
| backend | `wget -qO- localhost:3001/api/health` | 30s | 40s |
| frontend | `wget -qO- localhost/index.html` | 30s | 20s |

---

## 3. Vérification complète du déploiement

### 3.1 Procédure de vérification étape par étape

```bash
# ─── Étape 1 : Démarrage des services ──────────────────────────────
docker-compose up -d

# ─── Étape 2 : Attendre que tous les services soient healthy ────────
echo "Attente du démarrage (90s max)..."
timeout 90 bash -c '
  until [ "$(docker inspect aquaflow-backend --format="{{.State.Health.Status}}")" = "healthy" ]; do
    echo "  En attente du backend..."
    sleep 5
  done
'
echo "✅ Backend opérationnel"

# ─── Étape 3 : Health check API ─────────────────────────────────────
echo "Vérification de l'API..."
curl -f -s http://localhost:3001/api/health | grep -q '"status":"ok"' && \
  echo "✅ API saine" || echo "❌ API dégradée"

# ─── Étape 4 : Connectivité base de données ──────────────────────────
echo "Vérification PostgreSQL..."
docker exec aquaflow-postgres pg_isready -U postgres -d aquaflow && \
  echo "✅ PostgreSQL opérationnel" || echo "❌ PostgreSQL inaccessible"

# ─── Étape 5 : Connectivité Redis ────────────────────────────────────
echo "Vérification Redis..."
docker exec aquaflow-redis redis-cli ping | grep -q PONG && \
  echo "✅ Redis opérationnel" || echo "❌ Redis inaccessible"

# ─── Étape 6 : Connectivité MQTT ─────────────────────────────────────
echo "Vérification MQTT..."
docker exec aquaflow-mosquitto mosquitto_pub \
  -h localhost -p 1883 -t "test/health" -m "ping" -q 0 && \
  echo "✅ MQTT opérationnel" || echo "❌ MQTT inaccessible"

# ─── Étape 7 : Interface web ─────────────────────────────────────────
echo "Vérification frontend..."
curl -f -s -o /dev/null http://localhost:3000 && \
  echo "✅ Frontend accessible" || echo "❌ Frontend inaccessible"

# ─── Étape 8 : Initialisation base (premier déploiement) ─────────────
echo "Initialisation des données (si nécessaire)..."
docker exec aquaflow-backend npm run seed && \
  echo "✅ Données initialisées"
```

### 3.2 Test d'authentification via l'API

```bash
# Tester le login (credentials de démonstration)
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aquaflow.local","password":"Admin123!"}' | \
  python -m json.tool

# Réponse attendue :
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
#   "user": { "id": "...", "email": "admin@aquaflow.local", "role": "admin" }
# }
```

### 3.3 Test du flux IoT temps réel

```bash
# Terminal 1 — Observer les logs backend
docker logs -f aquaflow-backend | grep -E "sensor|mqtt|alert"

# Terminal 2 — Publier une mesure de test
docker exec aquaflow-mosquitto mosquitto_pub \
  -h localhost -p 1883 \
  -t "sensors/test-sensor-id/data" \
  -m '{"value": 95.2, "unit": "°C", "timestamp": "2026-06-07T10:00:00Z"}'

# Résultat attendu dans les logs backend :
# [IotService] Received sensor data: sensorId=test-sensor-id value=95.2
# [IotService] Sensor data processed and broadcast via Socket.IO
```

---

## 4. Monitoring et logs

### 4.1 Consultation des logs

```bash
# Tous les services en temps réel
docker-compose logs -f

# Service spécifique
docker logs -f aquaflow-backend
docker logs -f aquaflow-postgres
docker logs -f aquaflow-mosquitto

# Dernières N lignes
docker logs --tail=100 aquaflow-backend

# Logs avec horodatage
docker logs -t aquaflow-backend

# Filtrer par niveau
docker logs aquaflow-backend 2>&1 | grep -E "ERROR|WARN"
```

### 4.2 Rotation des logs (production)

Configurée dans `docker-compose.prod.yml` :

| Service | Taille max par fichier | Nombre de fichiers |
|---------|----------------------|-------------------|
| backend | 20 Mo | 5 |
| postgres | 10 Mo | 3 |
| redis | 5 Mo | 3 |
| mosquitto | 5 Mo | 3 |
| frontend | 5 Mo | 3 |

### 4.3 Surveillance des ressources

```bash
# Utilisation CPU et mémoire en temps réel
docker stats

# Format personnalisé
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Snapshot unique (sans refresh)
docker stats --no-stream
```

---

## 5. Sauvegarde et restauration

### 5.1 Sauvegarde PostgreSQL

```bash
# Sauvegarde complète
docker exec aquaflow-postgres pg_dump \
  -U postgres aquaflow > backup_$(date +%Y%m%d_%H%M%S).sql

# Sauvegarde compressée
docker exec aquaflow-postgres pg_dump \
  -U postgres aquaflow | gzip > backup_$(date +%Y%m%d).sql.gz

# Automatisation (cron — toutes les nuits à 2h)
# 0 2 * * * docker exec aquaflow-postgres pg_dump -U postgres aquaflow | \
#   gzip > /backups/aquaflow_$(date +\%Y\%m\%d).sql.gz
```

### 5.2 Restauration PostgreSQL

```bash
# Depuis une sauvegarde SQL
docker exec -i aquaflow-postgres psql -U postgres aquaflow < backup.sql

# Depuis une sauvegarde compressée
gunzip -c backup.sql.gz | docker exec -i aquaflow-postgres psql -U postgres aquaflow
```

### 5.3 Sauvegarde Redis (production avec AOF)

```bash
# Forcer la sauvegarde AOF immédiatement
docker exec aquaflow-redis redis-cli BGREWRITEAOF

# Copier le fichier AOF
docker cp aquaflow-redis:/data/appendonly.aof ./redis-backup.aof
```

---

## 6. Procédures de maintenance

### 6.1 Mise à jour de l'application

```bash
# 1. Récupérer les nouvelles sources
git pull origin main

# 2. Reconstruire et redémarrer
docker-compose down
docker-compose up --build -d

# 3. Appliquer les migrations DB si nécessaire
docker exec aquaflow-backend npm run migration:run

# 4. Vérifier le déploiement
curl -s http://localhost:3001/api/health
```

### 6.2 Redémarrage d'un service

```bash
# Redémarrer uniquement le backend (sans toucher les données)
docker-compose restart backend

# Redémarrer avec reconstruction de l'image
docker-compose up -d --build backend
```

### 6.3 Vider le cache Redis

```bash
docker exec aquaflow-redis redis-cli FLUSHDB
```

---

## 7. Récapitulatif — Checklist de déploiement opérationnel

| # | Vérification | Commande | Attendu |
|---|-------------|---------|---------|
| 1 | Tous les conteneurs `healthy` | `docker-compose ps` | 5 services healthy |
| 2 | API health check | `curl localhost:3001/api/health` | `"status":"ok"` |
| 3 | PostgreSQL connecté | `docker exec postgres pg_isready` | `accepting connections` |
| 4 | Redis connecté | `docker exec redis redis-cli ping` | `PONG` |
| 5 | MQTT opérationnel | `mosquitto_pub -t test/health -m ping` | Pas d'erreur |
| 6 | Frontend accessible | `curl -f localhost:3000` | HTTP 200 |
| 7 | Login fonctionnel | `POST /api/auth/login` | `accessToken` retourné |
| 8 | WebSocket connecté | Console navigateur → Network → WS | `connect` event |
| 9 | Swagger accessible | `http://localhost:3001/api/docs` | Page Swagger UI |
| 10 | Données initialisées | `npm run seed` (1er déploiement) | 4 utilisateurs créés |

Un déploiement est considéré **pleinement opérationnel** lorsque les 10 vérifications sont satisfaites.
