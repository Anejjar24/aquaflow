# REPORT_SCREENSHOTS_GUIDE.md
# AquaFlow — Guide des captures d'écran pour le rapport

> Pour chaque capture : intérêt académique + légende prête à l'emploi.

---

## SECTION A — Tests

---

### A1. Résultats d'exécution des tests backend

**Comment l'obtenir :**
```bash
cd backend
npm run test -- --verbose 2>&1 | tee test-results.txt
```

**Ce que ça montre :**
- La liste complète des 104 tests backend
- Les suites (describe) organisées par module
- Le statut ✓/✗ de chaque test
- La durée d'exécution totale

**Intérêt pour le rapport :**
Démontre que les services métier critiques (auth, alertes, capteurs, workflows) sont couverts par des tests unitaires automatisés et qu'ils passent tous avec succès.

**Légende académique :**
> *Figure X.X — Résultats d'exécution des tests unitaires backend (Jest). Les 104 cas de test répartis sur 7 modules NestJS s'exécutent avec succès, validant le comportement des services métier de la plateforme AquaFlow.*

---

### A2. Résultats d'exécution des tests frontend

**Comment l'obtenir :**
```bash
cd frontend
npm test -- --watchAll=false --verbose --forceExit 2>&1 | tee frontend-test-results.txt
```

**Ce que ça montre :**
- Les 63 tests Redux et WebSocket hook
- Les slices testées : alertsSlice, notificationsSlice
- Le hook useSocket avec ses 25 cas

**Légende académique :**
> *Figure X.X — Résultats d'exécution des tests unitaires frontend (Jest + React Testing Library). Les 63 cas de test valident le comportement des reducers Redux et du hook de communication temps réel Socket.IO.*

---

### A3. Rapport de couverture de code

**Comment l'obtenir :**
```bash
cd backend
npm run test:cov
# Ouvrir coverage/lcov-report/index.html dans un navigateur
```

**Ce que ça montre :**
- Pourcentage de couverture par fichier (statements, branches, functions, lines)
- Les lignes non couvertes surlignées en rouge
- Vue synthétique par module

**Intérêt pour le rapport :**
Justifie la qualité et l'exhaustivité des tests en montrant quelles parties du code sont couvertes.

**Légende académique :**
> *Figure X.X — Rapport de couverture de code généré par Jest (--coverage). Le tableau présente le taux de couverture par fichier pour les modules testés, distinguant les instructions, branches, fonctions et lignes.*

---

### A4. Pipeline CI/CD GitHub Actions — succès

**Comment l'obtenir :**
Aller sur GitHub → dépôt → onglet **Actions** → dernier workflow `backend-ci` ou `frontend-ci` réussi → capturer l'écran de la vue résumé (checkmarks verts).

**Ce que ça montre :**
- Les deux jobs : `lint-and-build` + `test`
- Les services Docker (PostgreSQL, Redis) lancés automatiquement
- La durée totale d'exécution
- Le statut global (✓ passed)

**Légende académique :**
> *Figure X.X — Pipeline d'intégration continue GitHub Actions pour le backend AquaFlow. Les deux étapes (lint/build et tests) s'exécutent automatiquement sur chaque push, avec provisionnement automatique des services PostgreSQL 15 et Redis 7.*

---

### A5. Pipeline CI/CD GitHub Actions — détail job test

**Comment l'obtenir :**
GitHub → Actions → cliquer sur le job `test` → voir les logs de l'étape "Run unit tests".

**Ce que ça montre :**
- La sortie Jest dans les logs CI
- Les services PostgreSQL et Redis actifs
- Le nombre de tests passés

**Légende académique :**
> *Figure X.X — Détail du job de test dans le pipeline CI/CD. Jest exécute les 104 cas de test unitaires avec une instance PostgreSQL 15 et Redis 7 provisionnées automatiquement par GitHub Actions.*

---

## SECTION B — Interface utilisateur

---

### B1. Dashboard principal — Vue d'ensemble

**URL :** `http://localhost:3000/#/admin/dashboard`
**Connexion :** `admin@aquaflow.local / Admin123!`

**Ce que ça montre :**
- KPIs en temps réel (stations actives, capteurs, alertes en cours)
- Graphiques de tendance
- Flux d'alertes récentes
- Indicateur de connexion WebSocket

**Légende académique :**
> *Figure X.X — Tableau de bord principal de la plateforme AquaFlow. La vue agrège en temps réel les indicateurs clés de performance (KPIs) des stations de supervision, les alertes actives et les tendances de mesure des capteurs.*

---

### B2. Workflow Builder — Canvas vide

**URL :** `http://localhost:3000/#/admin/automation`
**Action :** Cliquer "Nouveau workflow"

**Ce que ça montre :**
- L'éditeur visuel JointJS
- La barre latérale des blocs (23 types, 6 catégories)
- Le panneau de propriétés (vide)
- La barre d'outils (Save, Load, Settings, History)

**Légende académique :**
> *Figure X.X — Interface de l'éditeur visuel de workflows AquaFlow. Le canevas JointJS offre une palette de 23 types de nœuds organisés en 6 catégories (Générique, Industriel, Intégration), un panneau de propriétés contextuel et une barre d'outils complète.*

---

### B3. Workflow Builder — Workflow construit

**Action :** Construire un workflow : `input → sensor-read → threshold-check → decision → alert-trigger → output`

**Ce que ça montre :**
- Les nœuds connectés avec leurs ports
- Les couleurs distinctives par catégorie
- Les connexions avec les ports d'entrée/sortie
- Les labels de configuration sur les nœuds

**Légende académique :**
> *Figure X.X — Exemple de workflow de supervision industrielle construit dans l'éditeur AquaFlow. Le processus automatisé lit la valeur d'un capteur, vérifie le seuil, prend une décision conditionnelle et déclenche une alerte en cas de dépassement.*

---

### B4. Workflow Builder — Résultat d'exécution

**Action :** Exécuter le workflow → observer le panneau de résultats en bas.

**Ce que ça montre :**
- Le statut `COMPLETED` ou `FAILED`
- La durée d'exécution en ms
- La sortie finale (output JSON)
- Le journal d'exécution nœud par nœud

**Légende académique :**
> *Figure X.X — Panneau de résultat d'exécution d'un workflow AquaFlow. Chaque nœud du processus est journalisé avec ses données d'entrée/sortie, permettant la traçabilité complète de l'exécution automatisée.*

---

### B5. Page Alertes — Liste avec filtres

**URL :** `http://localhost:3000/#/admin/alerts`

**Ce que ça montre :**
- La liste paginée des alertes
- Les filtres par statut et sévérité
- Les badges de sévérité colorés (WARNING, CRITICAL)
- Les boutons d'action (Acquitter, Résoudre)

**Légende académique :**
> *Figure X.X — Interface de gestion des alertes AquaFlow. La vue présente les alertes actives avec leur sévérité, leur source (capteur/station) et les actions de cycle de vie disponibles (acquittement, résolution).*

---

### B6. Page Alertes — Modal de détail

**Action :** Cliquer sur une alerte dans le tableau.

**Ce que ça montre :**
- Les détails complets d'une alerte
- Le type, la sévérité, la description
- Les données contextuelles (JSON)
- Les horodatages (création, acquittement)

**Légende académique :**
> *Figure X.X — Modal de détail d'une alerte AquaFlow. La vue expose l'ensemble des métadonnées de l'alerte incluant les données contextuelles de déclenchement et l'historique de son cycle de vie.*

---

### B7. Monitoring temps réel — Mise à jour capteur

**URL :** `http://localhost:3000/#/admin/monitoring`
**Action :** Publier une mesure MQTT et observer la mise à jour immédiate.

```bash
# Publier via MQTT (depuis la machine hôte)
docker exec aquaflow-mosquitto mosquitto_pub \
  -h localhost -p 1883 \
  -t "sensors/SENSOR_ID/data" \
  -m '{"value": 87.5}'
```

**Ce que ça montre :**
- La valeur du capteur mise à jour sans rechargement de page
- L'indicateur de statut en ligne/hors ligne
- La réactivité temps réel via WebSocket

**Légende académique :**
> *Figure X.X — Page de monitoring AquaFlow avec mise à jour temps réel d'un capteur via le protocole MQTT. La valeur est transmise du capteur vers le broker Mosquitto, traitée par le service IoT NestJS et diffusée instantanément via Socket.IO.*

---

### B8. Page Notifications — Centre de notifications

**URL :** `http://localhost:3000/#/admin/notifications`

**Ce que ça montre :**
- La liste chronologique des notifications
- Le compteur de non-lus dans la cloche (header)
- Les boutons "Marquer comme lu" et "Tout marquer comme lu"

**Légende académique :**
> *Figure X.X — Centre de notifications AquaFlow. Les notifications en temps réel (alertes, assignations de maintenance) sont centralisées avec leur statut de lecture et leur horodatage.*

---

### B9. Page Maintenance — Tableau des ordres

**URL :** `http://localhost:3000/#/admin/maintenance`

**Ce que ça montre :**
- Les ordres de maintenance avec priorité et statut
- Les filtres par statut et priorité
- La colonne "Assigné à" (technicien)

**Légende académique :**
> *Figure X.X — Interface de gestion de la maintenance AquaFlow. Le tableau présente les ordres de travail avec leur priorité, statut et technicien assigné, filtrable par statut et niveau de priorité.*

---

## SECTION C — Infrastructure et déploiement

---

### C1. Docker containers en cours d'exécution

**Comment l'obtenir :**
```bash
docker-compose up -d
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Ce que ça montre :**
- Les 5 conteneurs actifs avec leur statut `healthy`
- Les ports mappés
- Le temps de démarrage

**Légende académique :**
> *Figure X.X — Conteneurs Docker de la plateforme AquaFlow en état opérationnel. Les cinq services (nginx, NestJS, PostgreSQL, Redis, Mosquitto) affichent le statut `healthy` confirming le bon fonctionnement des health checks configurés.*

---

### C2. Endpoint de santé — Réponse HTTP

**Comment l'obtenir :**
```bash
curl -s http://localhost:3001/api/health | python -m json.tool
```

**Résultat attendu :**
```json
{
  "status": "ok",
  "timestamp": "2026-06-07T10:00:00.000Z",
  "uptime": 3600,
  "db": { "status": "ok" },
  "redis": { "status": "ok" }
}
```

**Légende académique :**
> *Figure X.X — Réponse de l'endpoint de santé `GET /api/health` de l'API AquaFlow. La vérification simultanée de la base de données PostgreSQL et du cache Redis confirme l'état opérationnel complet de la plateforme.*

---

### C3. Swagger API Documentation

**URL :** `http://localhost:3001/api/docs`

**Ce que ça montre :**
- La liste complète des endpoints REST
- Les modèles de données (DTOs)
- L'authentification JWT intégrée
- Les exemples de requêtes/réponses

**Légende académique :**
> *Figure X.X — Documentation interactive Swagger de l'API REST AquaFlow. L'interface Swagger UI expose l'ensemble des endpoints protégés par JWT, organisés par module fonctionnel (Auth, Stations, Sensors, Alerts, Flows, Maintenance).*

---

### C4. Test API Postman — Authentification

**Collection Postman :**
1. `POST /api/auth/login` avec `{"email": "admin@aquaflow.local", "password": "Admin123!"}`
2. Observer la réponse : `accessToken`, `refreshToken`, profil utilisateur

**Légende académique :**
> *Figure X.X — Test de l'endpoint d'authentification `POST /api/auth/login` via Postman. La réponse retourne un jeton d'accès JWT (validité 1h), un jeton de renouvellement (validité 7j) et le profil de l'utilisateur authentifié.*

---

### C5. Test API Postman — Exécution de workflow

**Collection Postman :**
```
POST /api/flows/execute
Authorization: Bearer <token>
Body: { "graph": {...}, "input": {} }
```

**Légende académique :**
> *Figure X.X — Test de l'endpoint d'exécution ad-hoc `POST /api/flows/execute` via Postman. La réponse inclut le statut COMPLETED, la durée d'exécution en millisecondes et le journal détaillé des étapes.*

---

### C6. Console navigateur — Événements WebSocket

**Comment l'obtenir :**
1. Ouvrir `http://localhost:3000` dans Chrome
2. F12 → Network → WS
3. Cliquer sur la connexion Socket.IO
4. Observer les messages dans l'onglet "Messages"

**Ce que ça montre :**
- Les frames WebSocket entrantes (`sensor-update`, `alert-created`, `notification-created`)
- La structure JSON des payloads
- La latence des messages

**Légende académique :**
> *Figure X.X — Événements WebSocket Socket.IO capturés dans les outils de développement Chrome. Les messages `sensor-update`, `alert-created` et `notification-created` illustrent la communication bidirectionnelle temps réel entre le backend NestJS et le frontend React.*

---

### C7. Logs MQTT — Messages de capteurs

**Comment l'obtenir :**
```bash
# Terminal 1 — abonné (observer les messages)
docker exec aquaflow-mosquitto mosquitto_sub \
  -h localhost -p 1883 -t "sensors/#" -v

# Terminal 2 — publier un message de test
docker exec aquaflow-mosquitto mosquitto_pub \
  -h localhost -p 1883 \
  -t "sensors/test-sensor-id/data" \
  -m '{"value": 95.2, "unit": "°C", "timestamp": "2026-06-07T10:00:00Z"}'
```

**Légende académique :**
> *Figure X.X — Flux de messages MQTT sur le broker Mosquitto. La commande `mosquitto_sub` capture la publication d'une mesure de capteur sur le topic `sensors/#`, illustrant l'intégration IoT de la plateforme AquaFlow.*

---

## Ordre de présentation suggéré dans le rapport

```
Chapitre Tests :
  Figure A1 — Résultats tests backend
  Figure A2 — Résultats tests frontend
  Figure A3 — Rapport de couverture
  Figure A4 — Pipeline CI/CD (succès)
  Figure A5 — Détail job CI test

Chapitre Déploiement / Validation :
  Figure C1 — Docker containers healthy
  Figure C2 — Health check endpoint
  Figure C3 — Swagger API docs

Chapitre Présentation fonctionnelle :
  Figure B1 — Dashboard
  Figure B2 — Workflow Builder (canvas)
  Figure B3 — Workflow construit
  Figure B4 — Résultat d'exécution
  Figure B5 — Page Alertes
  Figure B7 — Monitoring temps réel
  Figure C6 — Événements WebSocket
  Figure C7 — Messages MQTT
```
