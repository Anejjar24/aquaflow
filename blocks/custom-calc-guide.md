# Guide complet — Bloc `custom-calc`

> **Fichier de référence** : tests manuels vérifiables, commandes Docker, configuration
> workflow builder et calculs pas-à-pas pour les 4 stratégies d'alignement temporel.

---

## Table des matières

1. [Présentation du bloc](#1-présentation-du-bloc)
2. [Propriétés du bloc](#2-propriétés-du-bloc)
3. [Modes de fenêtre temporelle (timeMode)](#3-modes-de-fenêtre-temporelle-timemode)
4. [Stratégies d'alignement (resampleStrategy)](#4-stratégies-dalignement-resamplestrategy)
5. [Output du bloc](#5-output-du-bloc)
6. [Commandes — Build & Seeds](#6-commandes--build--seeds)
7. [TEST 1 — forward_fill](#7-test-1--forward_fill)
8. [TEST 2 — interpolate](#8-test-2--interpolate)
9. [TEST 3 — downsample](#9-test-3--downsample)
10. [TEST 4 — last_n_minutes](#10-test-4--last_n_minutes)
11. [Résumé des 4 tests](#11-résumé-des-4-tests)

---

## 1. Présentation du bloc

Le bloc `custom-calc` lit des séries temporelles depuis un ou plusieurs capteurs
(jusqu'à 4 : `a`, `b`, `c`, `d`), aligne leurs timestamps, évalue une formule
mathématique à chaque point aligné, puis agrège tous les résultats en **une seule
valeur numérique de sortie**.

```
┌─────────────────────────────────────────────────────┐
│                   custom-calc                       │
│                                                     │
│  sensorA → variable a ──┐                           │
│  sensorB → variable b ──┼── alignement ── formule ──► result
│  sensorC → variable c ──┘     (a*b, a+b,            │
│  sensorD → variable d         (a*b)/100, etc.)      │
│                                                     │
│  Ports de sortie : result  /  error                 │
└─────────────────────────────────────────────────────┘
```

**Cas d'usage typiques :**
- Indice de confort thermique `(humidity * temperature) / 100`
- Efficacité de pompage `(flow / energy_consumed)`
- Mixing de plusieurs capteurs avec normalisation

---

## 2. Propriétés du bloc

| Propriété | Type | Valeurs possibles | Description |
|---|---|---|---|
| `formula` | string | ex. `a * b`, `(a + b) / 2` | Expression mathématique (mathjs) |
| `sensorA` | select | ID capteur | Capteur lié à la variable `a` |
| `sensorB` | select | ID capteur | Capteur lié à la variable `b` |
| `sensorC` | select | ID capteur | Capteur lié à la variable `c` *(optionnel)* |
| `sensorD` | select | ID capteur | Capteur lié à la variable `d` *(optionnel)* |
| `timeMode` | select | `all_data` / `last_n_minutes` / `custom_range` | Fenêtre temporelle |
| `periodMinutes` | number | ex. `6`, `60` | Durée en minutes *(si timeMode = last_n_minutes)* |
| `startDate` | datetime | ISO string | Début de plage *(si timeMode = custom_range)* |
| `endDate` | datetime | ISO string | Fin de plage *(si timeMode = custom_range)* |
| `resampleStrategy` | select | `interpolate` / `forward_fill` / `downsample` | Stratégie d'alignement |
| `downsampleAgg` | select | `mean` / `min` / `max` / `sum` | Agrégation des buckets *(si downsample)* |
| `aggregation` | select | `mean` / `min` / `max` / `sum` / `last` | Agrégation finale de la série résultante |

> **Limite de données :** le bloc lit au maximum **50 000 points** par capteur.

---

## 3. Modes de fenêtre temporelle (timeMode)

### `all_data`
Lit **toutes** les données disponibles pour chaque capteur (cap à 50 000 points).
Idéal pour les analyses complètes et les vérifications de tests.

### `last_n_minutes`
Fenêtre glissante : `startDate = NOW − periodMinutes × 60s`.
Les timestamps des données doivent être **récents** (relatifs à l'heure d'exécution).
⚠ Si vous relancez un seed avec des timestamps relatifs, il faut exécuter le
workflow **immédiatement** après le seed.

### `custom_range`
Plage fixe avec `startDate` et `endDate` explicites.
Parfait pour analyser une période précise dans l'historique.

---

## 4. Stratégies d'alignement (resampleStrategy)

Quand deux capteurs ont des timestamps différents, le bloc doit les aligner sur
une grille commune. Trois stratégies sont disponibles.

### `forward_fill` — Zero-Order Hold (ZOH)
```
Capteur A  : 10   20   30   40   50   60     (points denses)
              ├────┼────┼────┼────┼────┤
Capteur B  : 2              5              (points rares)
              │              │
Résultat B :  2    2    2    5    5    5    ← dernière valeur connue maintenue
```
**Usage typique :** commandes temps-réel, capteurs IoT, signaux discontinus.

### `interpolate` — Interpolation linéaire
```
Capteur A  : 10   20   30   40   50   60     (points denses = référence)
Capteur B  :  0              6        12   (3 points, linéaire)
              │    │    │    │    │    │
Résultat B :  0    2    4    6    8    10   ← valeur interpolée entre 2 bornes
```
**Usage typique :** capteurs physiques (température, pression), analyses post-traitement.

### `downsample` — Agrégation par bucket
```
Capteur A  :  2   4   6  |  8  10  12   (rapide = 6 pts)
Capteur B  : 10          | 20          (lent = 2 pts = GRILLE)
              ──bucket1──│──bucket2──
A_mean     :     4       |    10
B          :    10       |    20
résultat   :    14       |    30        ← formula a+b appliquée par bucket
```
**Usage typique :** rapports agrégés, dashboards de supervision, réduction de bruit.

---

## 5. Output du bloc

Le port `result` transmet un objet JSON :

```json
{
  "result": 145.0,
  "series": [
    { "timestamp": "2026-06-09T10:00:00.000Z", "value": 20 },
    { "timestamp": "2026-06-09T10:00:10.000Z", "value": 40 }
  ],
  "count": 6,
  "formula": "a * b",
  "aggregation": "mean",
  "resampleStrategy": "forward_fill",
  "variables": ["a", "b"],
  "branch": "result"
}
```

Le port `error` est déclenché si :
- Aucune formule configurée
- Aucun capteur configuré
- Aucune donnée dans la plage temporelle
- Erreur de syntaxe dans la formule

---

## 6. Commandes — Build & Seeds

### 6.1 Rebuild du backend (après modification du code)

```bash
# Rebuild l'image Docker du backend
docker compose build backend

# Redémarrer le backend
docker compose up -d backend
```

### 6.2 Rebuild du frontend (après modification de blocks.js)

```bash
docker compose build frontend
docker compose up -d frontend
```

### 6.3 Lancer les seeds de test

> ⚠ `NODE_ENV=development` est obligatoire pour que TypeORM crée les tables (`synchronize: true`).

```bash
# ─── Seed principal (données de démonstration) ───────────────────────
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed.js

# ─── Seed 4 tests stratégies (Tests 1, 2, 3, 4) ─────────────────────
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed-strategy-tests.js

# ─── Seed stream (10 lectures/capteur, résultat attendu : 18.1) ──────
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed-stream-test.js

# ─── Seed minimal 2 capteurs (résultat attendu : 22.5) ───────────────
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed-calc-test.js
```

### 6.4 Idempotence des seeds

| Opération | Comportement |
|---|---|
| Station / Capteur | `findOne` → crée seulement si inexistant (pas de doublon) |
| Lectures | `DELETE` toutes les lectures du capteur puis `INSERT` les nouvelles |
| Tests 1, 2, 3 | Timestamps **fixes** → même résultat à chaque exécution ✅ |
| Test 4 | Timestamps **relatifs à NOW** → à relancer juste avant de tester ⚠ |

### 6.5 Cas : "nest: not found" dans le container de production

```bash
# ❌ Ne pas faire — nest n'est pas dans l'image de production
docker compose exec backend npm run build

# ✅ Faire à la place — rebuild depuis l'hôte
docker compose build backend && docker compose up -d backend
```

---

## 7. TEST 1 — forward_fill

### Données (seed-strategy-tests)

**Station :** `Station Test ForwardFill`

**Sensor A** — `FF_SensorA_Temperature` | unité : `°C` | 6 lectures / 10 s

| Timestamp | Valeur |
|---|---|
| T+0 s  | 10 |
| T+10 s | 20 |
| T+20 s | 30 |
| T+30 s | 40 |
| T+40 s | 50 |
| T+50 s | 60 |

*(T = 2026-06-09T10:00:00Z)*

**Sensor B** — `FF_SensorB_Pressure` | unité : `bar` | 2 lectures / 30 s

| Timestamp | Valeur |
|---|---|
| T+0 s  | 2 |
| T+30 s | 5 |

---

### Calcul manuel (feuille Excel)

**Formule :** `a * b` | **Stratégie :** `forward_fill` | **Agrégation :** `mean`

Sensor A est la référence (6 points > 2 points de B).
À chaque timestamp de A, B est maintenu à la **dernière valeur connue**.

| t | A (réel) | B (forward_fill) | a × b |
|---|---|---|---|
| T+0 s  | 10 | **2** ← valeur initiale | **20** |
| T+10 s | 20 | **2** ← pas de mise à jour | **40** |
| T+20 s | 30 | **2** ← pas de mise à jour | **60** |
| T+30 s | 40 | **5** ← B se met à jour | **200** |
| T+40 s | 50 | **5** ← maintenu | **250** |
| T+50 s | 60 | **5** ← maintenu | **300** |
| | | **Somme** | **870** |
| | | **Moyenne (870÷6)** | **145.0** |

### ✅ Résultat attendu : `145.0`

---

### Configuration dans le Workflow Builder

```
Bloc : custom-calc
─────────────────────────────
formula           : a * b
stationA          : Station Test ForwardFill
sensorA           : FF_SensorA_Temperature   ← (copier l'ID depuis la console du seed)
stationB          : Station Test ForwardFill
sensorB           : FF_SensorB_Pressure      ← (copier l'ID depuis la console du seed)
timeMode          : all_data
resampleStrategy  : forward_fill
aggregation       : mean
```

**Connexion des ports :**
```
[Trigger / Input] ──► [custom-calc] ──(result)──► [data-output]
                                    ──(error)───► [notification]
```

---

## 8. TEST 2 — interpolate

### Données (seed-strategy-tests)

**Station :** `Station Test Interpolate`

**Sensor A** — `INTERP_SensorA_Temperature` | `°C` | 6 lectures, valeur constante = 10

| Timestamp | Valeur |
|---|---|
| T+0 s  | 10 |
| T+10 s | 10 |
| T+20 s | 10 |
| T+30 s | 10 |
| T+40 s | 10 |
| T+50 s | 10 |

**Sensor B** — `INTERP_SensorB_Pressure` | `bar` | 3 lectures, linéaire 0→6→12

| Timestamp | Valeur |
|---|---|
| T+0 s  |  0 |
| T+30 s |  6 |
| T+60 s | 12 |

---

### Calcul manuel (feuille Excel)

**Formule :** `a * b` | **Stratégie :** `interpolate` | **Agrégation :** `mean`

Sensor A est la référence (6 points > 3 points de B).
B est interpolé linéairement entre ses bornes connues.

**Formule d'interpolation :**
```
b(t) = b_before + (t - t_before) / (t_after - t_before) × (b_after - b_before)
```

| t | A (réel) | B (interpolé) | Calcul B | a × b |
|---|---|---|---|---|
| T+0 s  | 10 | 0.0  | `exact (borne)`                   | **0**   |
| T+10 s | 10 | 2.0  | `0 + (10/30) × 6 = 2.0`          | **20**  |
| T+20 s | 10 | 4.0  | `0 + (20/30) × 6 = 4.0`          | **40**  |
| T+30 s | 10 | 6.0  | `exact (borne)`                   | **60**  |
| T+40 s | 10 | 8.0  | `6 + (10/30) × 6 = 8.0`          | **80**  |
| T+50 s | 10 | 10.0 | `6 + (20/30) × 6 = 10.0`         | **100** |
| | | | **Somme** | **300** |
| | | | **Moyenne (300÷6)** | **50.0** |

### ✅ Résultat attendu : `50.0`

---

### Configuration dans le Workflow Builder

```
Bloc : custom-calc
─────────────────────────────
formula           : a * b
sensorA           : INTERP_SensorA_Temperature  ← ID depuis console seed
sensorB           : INTERP_SensorB_Pressure     ← ID depuis console seed
timeMode          : all_data
resampleStrategy  : interpolate
aggregation       : mean
```

---

## 9. TEST 3 — downsample

### Données (seed-strategy-tests)

**Station :** `Station Test Downsample`

**Sensor A** — `DOWN_SensorA_Flow` | `m3/h` | 6 lectures / 10 s (rapide)

| Timestamp | Valeur |
|---|---|
| T+0 s  |  2 |
| T+10 s |  4 |
| T+20 s |  6 |
| T+30 s |  8 |
| T+40 s | 10 |
| T+50 s | 12 |

**Sensor B** — `DOWN_SensorB_Level` | `%` | 2 lectures / 30 s (lent = **grille de référence**)

| Timestamp | Valeur |
|---|---|
| T+0 s  | 10 |
| T+30 s | 20 |

---

### Calcul manuel (feuille Excel)

**Formule :** `a + b` | **Stratégie :** `downsample` | **downsampleAgg :** `mean` | **Agrégation :** `mean`

**Règle :** la série la plus **lente** (intervalle moyen le plus grand) devient la grille.
- A : 5 intervalles de 10 s → avg = 10 s
- B : 1 intervalle de 30 s → avg = **30 s** ← B est la grille ✓

| Bucket | Bornes | Points A dans le bucket | A_mean | B (grille) | a + b |
|---|---|---|---|---|---|
| Bucket 1 | [T+0, T+30) | 2, 4, 6 | **(2+4+6)/3 = 4** | 10 | **14** |
| Bucket 2 | [T+30, T+60)| 8, 10, 12| **(8+10+12)/3 = 10**| 20 | **30** |
| | | | | **Somme** | **44** |
| | | | | **Moyenne (44÷2)** | **22.0** |

### ✅ Résultat attendu : `22.0`

---

### Configuration dans le Workflow Builder

```
Bloc : custom-calc
─────────────────────────────
formula           : a + b
sensorA           : DOWN_SensorA_Flow     ← ID depuis console seed
sensorB           : DOWN_SensorB_Level    ← ID depuis console seed
timeMode          : all_data
resampleStrategy  : downsample
downsampleAgg     : mean
aggregation       : mean
```

---

## 10. TEST 4 — last_n_minutes

> ⚠ **Ce test utilise des timestamps relatifs à NOW.** Il faut :
> 1. Relancer le seed juste avant de tester
> 2. Exécuter le workflow **immédiatement** après

```bash
# Relancer le seed pour rafraîchir les timestamps
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed-strategy-tests.js
```

### Données (seed-strategy-tests)

**Station :** `Station Test LastNMin`

**Sensor A** — `LNM_SensorA_Temperature` | `°C` | 5 lectures toutes les 2 min

| Timestamp relatif | Valeur | Dans fenêtre 6 min ? |
|---|---|---|
| NOW − 9 min | 10 | ❌ exclu |
| NOW − 7 min | 20 | ❌ exclu |
| NOW − 5 min | 30 | ✅ inclus |
| NOW − 3 min | 40 | ✅ inclus |
| NOW − 1 min | 50 | ✅ inclus |

**Sensor B** — `LNM_SensorB_Chlorine` | `mg/L` | 3 lectures toutes les 5 min

| Timestamp relatif | Valeur | Dans fenêtre 6 min ? |
|---|---|---|
| NOW − 10 min |  1 | ❌ exclu |
| NOW − 5 min  |  6 | ✅ inclus |
| NOW − 0 min  | 11 | ✅ inclus |

---

### Calcul manuel (feuille Excel)

**Formule :** `a + b` | **timeMode :** `last_n_minutes = 6` | **Stratégie :** `interpolate` | **Agrégation :** `mean`

**Après filtrage temporel :**
- A disponible dans la fenêtre : NOW−5m(30), NOW−3m(40), NOW−1m(50) → 3 points
- B disponible dans la fenêtre : NOW−5m(6), NOW−0m(11) → 2 points

**Référence :** A (3 points > 2 points de B)

**Formule d'interpolation de B :**
```
Bornes de B dans la fenêtre : (NOW-5m, 6) et (NOW-0m, 11)
Intervalle total : 5 minutes | Δvaleur : 11 - 6 = 5

b(t) = 6 + ((5 - minutes_avant_now) / 5) × 5
```

| t | A (réel) | B (interpolé) | Calcul B | a + b |
|---|---|---|---|---|
| NOW − 5 min | 30 | **6.0**  | `exact (borne)`              | **36** |
| NOW − 3 min | 40 | **8.0**  | `6 + (2/5) × 5 = 6 + 2 = 8` | **48** |
| NOW − 1 min | 50 | **10.0** | `6 + (4/5) × 5 = 6 + 4 = 10`| **60** |
| | | | **Somme** | **144** |
| | | | **Moyenne (144÷3)** | **48.0** |

**Détail du ratio pour NOW−3m :**
```
t = NOW - 3min, borne_gauche = NOW-5min, borne_droite = NOW-0min
ratio = (5 - 3) / (5 - 0) = 2/5 = 0.4
b = 6 + 0.4 × (11 - 6) = 6 + 2 = 8.0
```

### ✅ Résultat attendu : `48.0`

---

### Configuration dans le Workflow Builder

```
Bloc : custom-calc
─────────────────────────────
formula           : a + b
sensorA           : LNM_SensorA_Temperature  ← ID depuis console seed
sensorB           : LNM_SensorB_Chlorine     ← ID depuis console seed
timeMode          : last_n_minutes
periodMinutes     : 6
resampleStrategy  : interpolate
aggregation       : mean
```

---

## 11. Résumé des 4 tests

| # | Strategy | Formula | Sensors | Résultat attendu | Timestamps |
|---|---|---|---|---|---|
| 1 | `forward_fill` | `a * b` | FF_SensorA / FF_SensorB | **145.0** | Fixes ✅ |
| 2 | `interpolate`  | `a * b` | INTERP_SensorA / INTERP_SensorB | **50.0** | Fixes ✅ |
| 3 | `downsample`   | `a + b` | DOWN_SensorA / DOWN_SensorB | **22.0** | Fixes ✅ |
| 4 | `last_n_minutes=6` | `a + b` | LNM_SensorA / LNM_SensorB | **48.0** | Relatifs ⚠ |

### Commande unique pour relancer tous les seeds avant les tests

```bash
# Tests 1, 2, 3 : relancer si les données ont été modifiées
# Test 4 : TOUJOURS relancer juste avant de tester dans le builder
docker compose exec -e NODE_ENV=development backend \
  node dist/database/seeds/seed-strategy-tests.js
```

### Trouver les IDs des capteurs dans la console

Après exécution du seed, la console affiche les IDs :

```
════════════════════════════════════════════════════════════
 TEST 1 — forward_fill (Zero-Order Hold)
════════════════════════════════════════════════════════════
sensorA ID : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  ← copier cet ID dans le builder
sensorB ID : yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy  ← copier cet ID dans le builder
```

### Exemple de workflow avec data-output pour voir le résultat

```
[Manual Trigger]
      │
      ▼
[custom-calc]
   formula: a * b
   sensorA: <ID>
   sensorB: <ID>
   timeMode: all_data
   resampleStrategy: forward_fill
   aggregation: mean
      │
  (result)──────────────────────────────────►[data-output]
  (error)───────────────────────────────────►[notification]
```

Le port `result` de `data-output` affiche dans l'interface :
```json
{
  "result": 145,
  "count": 6,
  "formula": "a * b",
  "series": [ ... ],
  "branch": "result"
}
```

---

*Guide généré le 2026-06-09 — AquaFlow custom-calc reference*
