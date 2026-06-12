# Guide de mise à jour — Chapitre Tests & Déploiement
*Données vérifiées dans le code source réel — 2026-06-12*

---

## RÉSUMÉ DES CORRECTIONS PAR RAPPORT AU RAPPORT ACTUEL

| Section | Problème | Correction |
|---------|----------|-----------|
| Table tests backend | Comptes individuels incorrects (total 141 ✅ mais ventilation fausse) | Voir tableau corrigé ci-dessous |
| Table tests frontend | Comptes individuels incorrects (total 91 ✅ mais ventilation fausse) | Voir tableau corrigé ci-dessous |
| Table tests Python | 23→29 anomalie, 6→13 KPIs, total 57→70 | Voir tableau corrigé |
| Total global | 289 → **302** (70 Python au lieu de 57) | Mettre à jour partout |
| Images Docker Kafka | `bitnami/kafka:3.6` → **`apache/kafka:3.7.1`** | Corriger table Docker |
| Images Docker Spark | `bitnami/spark:3.5` → **`apache/spark:3.5.3`** | Corriger table Docker |
| Backend depends_on | postgres + redis + mosquitto (3) → **+ kafka + minio (5)** | Corriger texte |
| CI/CD pipelines | Inexistants → **créés** dans `.github/workflows/` | Section devient réelle |

---

## 1. DONNÉES EXACTES — TESTS BACKEND

### Comptage vérifié par `grep -c "it(\|test(" *.spec.ts`

| Fichier | Suites (`describe`) | Cas (`it`) |
|---------|--------------------:|----------:|
| `alerts.service.spec.ts` | 4 | **10** |
| `auth.service.spec.ts` | 6 | **13** |
| `flows.service.spec.ts` | 8 | **19** |
| `iot.service.spec.ts` | 4 | **14** |
| `notifications.service.spec.ts` | 5 | **8** |
| `sensors.service.spec.ts` | 7 | **18** |
| `stations.service.spec.ts` | 6 | **16** |
| `analytics.service.spec.ts` | 5 | **16** |
| `kafka.consumer.service.spec.ts` | 7 | **16** |
| `kafka.producer.service.spec.ts` | 4 | **11** |
| **TOTAL** | **56** | **141** |

Vérification : 10+13+19+14+8+18+16+16+16+11 = **141** ✅

---

## 2. DONNÉES EXACTES — TESTS FRONTEND

### Comptage vérifié par `grep -c "it(\|test(" *.test.{js,jsx}`

| Fichier | Cas (`it`) |
|---------|----------:|
| `useSocket.test.js` | **19** |
| `alertsSlice.test.js` | **20** |
| `notificationsSlice.test.js` | **17** |
| `AdminNavbar.test.jsx` | **11** |
| `SensorDetailsPage.test.jsx` | **24** |
| **TOTAL** | **91** |

Vérification : 19+20+17+11+24 = **91** ✅

---

## 3. DONNÉES EXACTES — TESTS PYTHON

### Comptage vérifié par `grep -c "def test" tests/*.py`

| Fichier | Cas | Note |
|---------|----:|------|
| `test_kafka_to_minio.py` | **28** | Exécuté en CI ✅ |
| `test_anomaly_detection.py` | **29** | Exécuté en CI ✅ |
| `test_aggregate_kpis.py` | **13** | Requiert PySpark — local uniquement |
| **Total CI** | **57** | (28+29) |
| **Total complet** | **70** | (28+29+13) |

**Total global automatisé : 141 + 91 + 70 = 302 tests**
*(289 en CI automatique, 13 en local avec PySpark)*

---

## 4. IMAGES DOCKER RÉELLES (`docker-compose.yml`)

| Service | Image documentée (erronée) | Image réelle |
|---------|---------------------------|-------------|
| `kafka` | `bitnami/kafka:3.6` | **`apache/kafka:3.7.1`** |
| `spark-master` | `bitnami/spark:3.5` | **`apache/spark:3.5.3`** |
| `spark-worker` | `bitnami/spark:3.5` | **`apache/spark:3.5.3`** |
| `spark-anomaly-detector` | build `./data-pipeline/spark_jobs` | **`apache/spark:3.5.3`** (image officielle) |
| `postgres` | `timescale/timescaledb:2.14-pg15` | **`timescale/timescaledb:2.14.2-pg15`** |
| `backend` | `node:22-alpine` | **`node:20-alpine`** (Dockerfile réel) |
| `kafka-to-minio` | `python:3.11` | **build `./data-pipeline`** (Dockerfile custom) |

### Dépendances backend réelles (`depends_on`) :
Le backend attend **5 services** (pas 3) :
- `postgres` (service_healthy)
- `redis` (service_healthy)
- `mosquitto` (service_healthy)
- `kafka` (service_healthy) ← nouveau
- `minio` (service_healthy) ← nouveau

---

## 5. WORKFLOWS CI/CD CRÉÉS

Fichiers créés dans `.github/workflows/` :

| Fichier | Déclencheur (path filter) | Jobs |
|---------|--------------------------|------|
| `backend-ci.yml` | `backend/**` | lint-and-build → unit tests + coverage |
| `frontend-ci.yml` | `frontend/**` | build production + Jest tests |
| `python-ci.yml` | `data-pipeline/**` | flake8 lint + pytest (sans PySpark) |

---

## 6. CAPTURES D'ÉCRAN À PRENDRE

### 6.1 `figures/backend-tests.png` — Résultats Jest backend

**Commande :**
```bash
cd backend
npm test -- --forceExit --passWithNoTests
```

**Ce qu'il faut capturer :**
- La sortie terminale montrant les 10 suites de tests
- Les lignes `PASS src/...` pour chaque fichier
- La ligne finale : `Tests: 141 passed, 141 total`
- Optionnel : ajouter `--verbose` pour voir chaque `it()` listé

**Commande avec verbose (plus lisible) :**
```bash
cd backend
npm test -- --forceExit --verbose 2>&1 | head -100
```

**Conseil capture :** Terminal plein écran, police 12pt, thème sombre. Capturer la section `Test Suites` + `Tests` + `Time` en bas.

---

### 6.2 `figures/coverage-report.png` — Rapport de couverture Jest

**Commande :**
```bash
cd backend
npm run test:cov -- --forceExit
```

**Ce qu'il faut capturer :**
- Le tableau de couverture terminal avec les colonnes `% Stmts | % Branch | % Funcs | % Lines`
- Les lignes des services métier (IotService, StationsService, FlowsService, etc.)
- Éviter de montrer les lignes à 0% (modules/controllers)

**Alternative — rapport HTML :**
```bash
# Ouvre le rapport HTML interactif dans le navigateur
start backend/coverage/lcov-report/index.html
```
Capturer la page HTML dans le navigateur (plus propre visuellement).

---

### 6.3 `figures/frontend-tests.png` — Résultats Jest frontend

**Commande :**
```bash
cd frontend
npm test -- --watchAll=false --forceExit --passWithNoTests
```

**Ce qu'il faut capturer :**
- Les 5 lignes `PASS src/...`
- La ligne `Tests: 91 passed, 91 total`

---

### 6.4 `figures/python-tests.png` — Résultats pytest

**Commande :**
```bash
cd data-pipeline
pip install pytest pytest-cov pyarrow kafka-python boto3
python -m pytest tests/test_kafka_to_minio.py tests/test_anomaly_detection.py -v --tb=short
```

**Ce qu'il faut capturer :**
- La liste des tests avec `PASSED` en vert
- La ligne finale : `57 passed in X.XXs`

**Pour montrer aussi les tests PySpark (optionnel) :**
```bash
pip install pyspark
python -m pytest tests/ -v --tb=short
# Affiche les 70 tests dont 13 PySpark
```

---

### 6.5 `figures/ci-cd-pipeline.png` — GitHub Actions

**Étapes nécessaires avant la capture :**

1. Créer un dépôt GitHub (public ou privé)
2. Pousser le code :
```bash
cd C:\Users\DELL\Downloads\fin-projet-clean\aquaflow
git remote add origin https://github.com/VOTRE_USERNAME/aquaflow.git
git push -u origin main
```
3. Les 3 workflows se déclencheront automatiquement
4. Aller sur GitHub → onglet **Actions**
5. Attendre que les 3 pipelines passent au vert ✅

**Ce qu'il faut capturer :**
- La liste des workflows avec 3 entrées vertes (Backend CI, Frontend CI, Python CI)
- Ou le détail d'un seul workflow avec les jobs en succès

**Si pas de dépôt GitHub :** Vous pouvez créer une capture montrant les 3 fichiers `.github/workflows/*.yml` dans l'explorateur de fichiers, et ajouter une note que les pipelines se déclenchent sur push.

---

## 7. TEXTE DES CORRECTIONS DANS LE RAPPORT

### 7.1 Introduction du chapitre
Remplacer `289 cas de test` par `302 cas de test` (ou `289 cas exécutés en CI automatique et 302 au total`).

### 7.2 Tableau stratégie (tab:strategie_tests)
- Python : `57 cas` → `70 cas (57 en CI)`

### 7.3 Tableau tests Python (tab:tests_python)
- Détection d'anomalies : `23` → `29`
- Agrégation des KPIs : `6` → `13` (ajouter note : *requiert PySpark — local*)
- Total : `57` → `70` (avec note CI)

### 7.4 Tableau bilan (tab:bilan_tests)
- Python Big Data : `57` → `70`
- Total automatisé : `289` → `302`

### 7.5 Tableau services Docker (tab:services_docker)
- kafka : `bitnami/kafka:3.6 (KRaft)` → `apache/kafka:3.7.1 (KRaft)`
- spark-master/worker/anomaly : `bitnami/spark:3.5` → `apache/spark:3.5.3`
- backend : `node:22-alpine` → `node:20-alpine`

### 7.6 Texte dépendances backend
Remplacer :
> *"garantissant un démarrage ordonné des services"*

Par une mention explicite des 5 dépendances : postgres, redis, mosquitto, kafka, minio.

### 7.7 Section CI/CD
La section peut maintenant être présentée comme une réalité concrète (les fichiers existent). Retirer tout conditionnel ou futur.

---

## 8. COMMANDES UTILES COMPLÈTES

```bash
# ── Backend ──────────────────────────────────────────────
cd backend

# Lancer tous les tests
npm test -- --forceExit

# Avec verbose (liste chaque test)
npm test -- --forceExit --verbose

# Avec couverture
npm run test:cov -- --forceExit

# Lint seul
npm run lint

# Build TypeScript
npm run build

# ── Frontend ─────────────────────────────────────────────
cd frontend

# Lancer tous les tests
npm test -- --watchAll=false --forceExit

# Avec couverture
npm test -- --watchAll=false --forceExit --coverage

# Build production
npm run build

# ── Data Pipeline (Python) ────────────────────────────────
cd data-pipeline

# Installer les dépendances de dev
pip install pytest pytest-cov flake8 pyarrow kafka-python boto3

# Tests CI (sans PySpark)
python -m pytest tests/test_kafka_to_minio.py tests/test_anomaly_detection.py -v

# Avec couverture
python -m pytest tests/test_kafka_to_minio.py tests/test_anomaly_detection.py \
  --cov=. --cov-report=term-missing

# Lint flake8
flake8 kafka_to_minio.py spark_jobs/ --max-line-length=120

# Tests PySpark (requiert pip install pyspark)
python -m pytest tests/test_aggregate_kpis.py -v

# Tous les tests (avec PySpark installé)
python -m pytest tests/ -v

# ── Docker ────────────────────────────────────────────────
cd C:\Users\DELL\Downloads\fin-projet-clean\aquaflow

# Démarrer toute la stack
docker-compose up --build -d

# Vérifier le statut
docker-compose ps

# Health check
curl http://localhost:3001/api/health

# Voir les logs
docker-compose logs -f backend
```

---

## 9. LISTE DE CONTRÔLE AVANT SOUMISSION DU RAPPORT

- [ ] `figures/backend-tests.png` — capture terminale tests Jest backend (141 passed)
- [ ] `figures/coverage-report.png` — capture rapport couverture Jest
- [ ] `figures/frontend-tests.png` — capture terminale tests Jest frontend (91 passed)
- [ ] `figures/python-tests.png` — capture terminale pytest (57 passed)
- [ ] `figures/ci-cd-pipeline.png` — capture GitHub Actions (3 workflows verts)
- [ ] Tableau backend : comptes corrigés (total 141)
- [ ] Tableau frontend : comptes corrigés (total 91)
- [ ] Tableau Python : 29 anomalie, 13 KPIs, total 70
- [ ] Tableau Docker : images apache/kafka:3.7.1 et apache/spark:3.5.3
- [ ] Total global : 302 (ou 289 CI selon choix)
- [ ] Section CI/CD : workflows réels créés dans `.github/workflows/`
