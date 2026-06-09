# AquaFlow — Industrial Blocks Complete Guide (v2 — corrigé)

> **Scope:** Ce document couvre tous les blocs industriels disponibles dans le
> Workflow Builder d'AquaFlow, avec les opérations et ports **exacts** tels
> qu'implémentés dans le backend (handlers NestJS).  
> Pour chaque bloc : ce qu'il fait, son contrat entrée/sortie, toutes les
> propriétés configurables, quand l'utiliser, et cinq scénarios end-to-end.

---

## Table des matières

1. [Blocs industriels de base](#1-blocs-industriels-de-base)
   - [sensor-read](#11-sensor-read)
   - [threshold-check](#12-threshold-check)
   - [alert-trigger](#13-alert-trigger)
   - [mqtt-publish](#14-mqtt-publish)
   - [pump-control](#15-pump-control)
   - [station-control](#16-station-control)
2. [Blocs industriels étendus](#2-blocs-industriels-étendus)
   - [value-transform](#21-value-transform)
   - [sensor-check](#22-sensor-check)
   - [data-aggregate](#23-data-aggregate)
   - [stream-filter](#24-stream-filter)
   - [data-output](#25-data-output)
3. [Bloc de calcul personnalisé](#3-bloc-de-calcul-personnalisé)
   - [custom-calc](#31-custom-calc)
4. [Scénarios combinés](#4-scénarios-combinés)
   - [Scénario A — Détection surpression & arrêt automatique](#scénario-a--détection-surpression--arrêt-automatique)
   - [Scénario B — Rapport journalier débit + log anomalie](#scénario-b--rapport-journalier-débit--log-anomalie)
   - [Scénario C — Calcul dose chlore & commande MQTT](#scénario-c--calcul-dose-chlore--commande-mqtt)
   - [Scénario D — Contrôle qualité multi-capteurs](#scénario-d--contrôle-qualité-multi-capteurs)
   - [Scénario E — Alerte précoce rupture de canalisation](#scénario-e--alerte-précoce-rupture-de-canalisation)

---

## 1. Blocs industriels de base

---

### 1.1 `sensor-read`

**Ce que ça fait**  
Récupère des données en direct ou historiques depuis un capteur de la base de
données. Selon l'opération choisie, retourne soit une valeur scalaire, soit un
tableau de séries temporelles.

**Quand l'utiliser**  
Utiliser `sensor-read` comme **point d'entrée** de tout workflow qui a besoin de
données capteur réelles. Il remplace un bloc `input` manuel quand la valeur doit
venir de la base de données.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `sensorId` | select | ✓ (sauf batch) | Capteur à lire |
| `operation` | select | ✓ | Voir tableau ci-dessous |
| `timeRange` | select | pour `history` | `last_hour` · `last_6h` · `last_24h` · `last_week` |
| `limit` | number | pour `history` / `batch` | Nombre max de résultats (100 max) |
| `stationId` | select | pour `batch` | Station dont on lit tous les capteurs |
| `sensorType` | select | pour `batch` | `all` · `pressure` · `flow` · `temperature` · `ph` · `turbidity` · `chlorine` · `level` |
| `offlineTimeout` | number | pour `status_check` | Délai en minutes avant de considérer un capteur offline (défaut : 5) |
| `deltaThreshold` | number | pour `delta` | % de variation considéré comme significatif (défaut : 5) |

**Opérations disponibles**

| Opération | Ce que ça retourne |
|---|---|
| `single` | Dernière valeur connue du capteur (scalaire) |
| `history` | Tableau `[{ id, value, timestamp }]` des N dernières lectures |
| `batch` | Tableau de tous les capteurs d'un type dans une station |
| `status_check` | Statut online/offline du capteur avec minutesSince |
| `delta` | Différence entre les 2 dernières lectures + direction + % de changement |

**Ports de sortie**

| Port | Opération | Contenu |
|---|---|---|
| `value` | `single` | `{ sensorId, name, value, unit, timestamp, status, stationId }` |
| `readings` | `history` | `{ readings: [...], count, sensorId }` |
| `sensors` | `batch` | `{ sensors: [...], count }` |
| `online` / `offline` / `error` | `status_check` | `{ sensorId, status, minutesSince, branch }` |
| `significant` / `stable` / `error` | `delta` | `{ current, previous, change, changePercent, direction, significant }` |

**Exemple de sortie — `single`**
```json
{ "sensorId": "s-001", "name": "Tunis Inlet Pressure", "value": 3.24, "unit": "bar", "timestamp": "2026-06-09T10:00:00Z", "status": "active" }
```

**Exemple de sortie — `history`**
```json
{ "readings": [{ "id": "...", "value": 3.21, "timestamp": "..." }, ...], "count": 10, "sensorId": "s-001" }
```

> ⚠️ `average`, `min`, `max`, `latest` n'existent **pas** dans ce bloc.  
> Pour calculer une moyenne, utiliser `history` → `data-aggregate (stats ou moving_average)`.

---

### 1.2 `threshold-check`

**Ce que ça fait**  
Compare une valeur numérique par rapport à des seuils min/max configurés et
route vers le port `pass` ou `breach`.

**Quand l'utiliser**  
Branching binaire sur une valeur capteur. Idéal pour "la pression est-elle trop
haute ?" avant de déclencher une alerte ou une commande actionneur.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `minThreshold` | number | selon mode | Seuil bas |
| `maxThreshold` | number | selon mode | Seuil haut |
| `mode` | select | ✓ | `between` · `above_max` · `below_min` |

**Modes**

| Mode | Breach si… |
|---|---|
| `between` | valeur < min **ou** valeur > max |
| `above_max` | valeur > max |
| `below_min` | valeur < min |

**Entrée**  
Tout objet avec un champ `value` (typiquement la sortie de `sensor-read`).

**Ports de sortie**

| Port | Condition |
|---|---|
| `pass` | Condition OK — aucun seuil dépassé |
| `breach` | Seuil dépassé — transmet l'objet d'entrée enrichi |

> ⚠️ Les ports s'appellent `pass` et `breach` — **pas** `above`/`below`.

---

### 1.3 `alert-trigger`

**Ce que ça fait**  
Crée un enregistrement d'alerte persistant dans la base de données et envoie
optionnellement une notification temps réel via WebSocket au dashboard.

**Quand l'utiliser**  
Toujours à la **fin** d'une branche d'alarme. Ne pas utiliser pour du logging
informationnel — utiliser `data-output (operation: log)` à la place.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `title` | string | ✓ | Titre de l'alerte |
| `message` | string | ✓ | Message détaillé (supporte `{{value}}` pour interpolation) |
| `severity` | select | ✓ | `info` · `warning` · `critical` |
| `stationId` | select | | Station à laquelle rattacher l'alerte |

**Entrée**  
Tout objet — son champ `value` est utilisé pour l'interpolation `{{value}}`.

**Port de sortie**

| Port | Contenu |
|---|---|
| `triggered` | Entrée originale enrichie avec `alertId` |

---

### 1.4 `mqtt-publish`

**Ce que ça fait**  
Publie un message vers un topic Mosquitto MQTT. Utilisé pour envoyer des
commandes aux équipements de terrain (PLCs, RTUs, actionneurs) qui s'abonnent
au broker.

**Quand l'utiliser**  
Quand une décision workflow doit atteindre un équipement physique en temps réel.
Usages typiques : ouvrir/fermer une vanne, régler la vitesse d'une pompe.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `topic` | string | ✓ | Topic MQTT (ex. `stations/s1/pump/cmd`) |
| `payload` | string | ✓ | Payload du message — texte statique ou template JSON |
| `qos` | select | | `0` · `1` · `2` (défaut `0`) |
| `retain` | boolean | | Le broker conserve-t-il le dernier message ? |

**Port de sortie**

| Port | Contenu |
|---|---|
| `sent` | Entrée originale + `{ topic, payload, publishedAt }` |

---

### 1.5 `pump-control`

**Ce que ça fait**  
Wrapper haut niveau qui publie une commande start/stop/speed structurée vers le
topic MQTT de contrôle d'une pompe. Enforces le format correct de payload.

**Quand l'utiliser**  
Préférer `pump-control` à un `mqtt-publish` brut pour contrôler les pompes
AquaFlow — le format payload est garanti et la commande est auditée.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `stationId` | select | ✓ | Station propriétaire de la pompe |
| `pumpId` | string | ✓ | Identifiant de la pompe |
| `command` | select | ✓ | `start` · `stop` · `set_speed` |
| `speed` | number | pour `set_speed` | Vitesse cible 0–100 % |

**Entrée / Sortie**  
Même pattern pass-through que `mqtt-publish`. Port de sortie : `done`.

---

### 1.6 `station-control`

**Ce que ça fait**  
Modifie le statut opérationnel d'une station de supervision directement en base
de données via `StationsService`.

**Quand l'utiliser**  
Dans les workflows de planification de maintenance ou après détection d'une
panne critique qui devrait isoler la station.

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `stationId` | select | ✓ | Station cible |
| `targetStatus` | select | ✓ | `active` · `maintenance` · `offline` |
| `reason` | string | | Raison humaine stockée dans l'audit log |

**Port de sortie**

| Port | Contenu |
|---|---|
| `done` | `{ stationId, previousStatus, newStatus, changedAt }` |

---

## 2. Blocs industriels étendus

---

### 2.1 `value-transform`

**Ce que ça fait**  
Applique une transformation mathématique à une valeur numérique `value` en
amont. Cinq opérations couvrent les conversions d'unités et tâches de qualité
de données les plus courantes.

**Quand l'utiliser**  
Insérer entre `sensor-read` et tout bloc de décision ou de sortie quand la
valeur brute du capteur doit être convertie, bridée ou normalisée.

**Propriétés**

| Propriété | Type | Affiché pour | Description |
|---|---|---|---|
| `operation` | select | toujours | `scale` · `clamp` · `round` · `abs` · `formula` |
| `factor` | number | `scale` | Multiplicateur |
| `offset` | number | `scale` | Ajouté après multiplication : `résultat = valeur × factor + offset` |
| `min` | number | `clamp` | Borne inférieure |
| `max` | number | `clamp` | Borne supérieure |
| `decimals` | number | `round` | Nombre de décimales |
| `expression` | string | `formula` | Expression mathjs — utiliser `x` pour la valeur d'entrée |

**Port de sortie**

| Port | Contenu |
|---|---|
| `result` | `{ value: <transformé>, original: <brut> }` |

**Exemples**

- `scale` — convertir courant 4–20 mA en 0–10 bar : `factor = 0.625`, `offset = -2.5`
- `formula` — convertir Celsius en Fahrenheit : `expression = "x * 9/5 + 32"`
- `clamp` — brider un pH à 0–14 : `min = 0`, `max = 14`

---

### 2.2 `sensor-check`

**Ce que ça fait**  
Évalue une condition avancée sur une valeur capteur et route vers différents
ports selon le résultat. Six opérations couvrent la détection de seuils
multiples, les taux de variation, les bandes mortes, les anomalies statistiques,
la comparaison de deux capteurs, et le filtrage par plage horaire.

**Quand l'utiliser**  
Quand `threshold-check` est trop simple : besoin de 3 niveaux de seuil,
comparaison capteur vs capteur, détection d'anomalie Z-score, ou gate temporel.

**Propriétés**

| Propriété | Type | Opération | Description |
|---|---|---|---|
| `operation` | select | toujours | `multi_threshold` · `rate_of_change` · `deadband` · `anomaly` · `compare` · `time_window` |
| `warningThreshold` | number | `multi_threshold` | Seuil warning (défaut 60) |
| `criticalThreshold` | number | `multi_threshold` | Seuil critique (défaut 80) |
| `emergencyThreshold` | number | `multi_threshold` | Seuil urgence (défaut 95) |
| `maxRatePerSec` | number | `rate_of_change` | Taux de variation max autorisé par seconde |
| `minRatePerSec` | number | `rate_of_change` | Taux de variation min autorisé par seconde |
| `deadbandWidth` | number | `deadband` | Largeur de la bande morte (défaut 2) |
| `deadbandMode` | select | `deadband` | `absolute` · `percent` |
| `windowSize` | number | `anomaly` / `trend` | Taille de la fenêtre d'analyse |
| `zscoreThreshold` | number | `anomaly` | Seuil Z-score (défaut 3) |
| `tolerance` | number | `compare` | Tolérance pour l'égalité (défaut 0.01) |
| `startTime` | string | `time_window` | Heure de début `HH:MM` (défaut `08:00`) |
| `endTime` | string | `time_window` | Heure de fin `HH:MM` (défaut `18:00`) |
| `daysOfWeek` | string | `time_window` | Jours autorisés ex. `1,2,3,4,5` (0=dim) |

**Ports de sortie par opération**

| Opération | Ports |
|---|---|
| `multi_threshold` | `normal` · `warning` · `critical` · `emergency` |
| `rate_of_change` | `normal` · `too_fast` · `too_slow` |
| `deadband` | `changed` · `suppressed` |
| `anomaly` | `normal` · `anomaly` |
| `compare` | `equal` · `a_greater` · `b_greater` |
| `time_window` | `allowed` · `blocked` |

> ⚠️ Les opérations `above`, `below`, `between`, `outside`, `equals` de la
> documentation précédente n'existent **pas**. Utiliser `threshold-check` pour
> les comparaisons simples, ou `multi_threshold` pour 3 niveaux.

**Note pour `anomaly`**  
Requiert un tableau de valeurs en entrée. Connecter la sortie `readings` de
`sensor-read (history)` directement à ce bloc.

**Note pour `compare`**  
L'entrée doit contenir `{ valueA, valueB }`. Utiliser un bloc `data-transform
(set_field)` pour fusionner les sorties de deux `sensor-read` distincts.

---

### 2.3 `data-aggregate`

**Ce que ça fait**  
Consomme un tableau de valeurs (la sortie `readings` de `sensor-read history`
ou `sensors` de `batch`) et le réduit à une métrique agrégée.

**Quand l'utiliser**  
Après un `sensor-read (history)` quand on a besoin d'une moyenne, d'une
détection de tendance, d'un comptage d'événements, ou d'une moyenne mobile.

**Propriétés**

| Propriété | Type | Opération | Description |
|---|---|---|---|
| `operation` | select | toujours | `stats` · `station_stats` · `event_counter` · `trend` · `moving_average` |
| `stationId` | select | `station_stats` | Station à agréger |
| `sensorType` | select | `station_stats` | Type de capteurs à agréger |
| `countThreshold` | number | `event_counter` | Nb d'items déclenchant `threshold_reached` (défaut 5) |
| `windowSeconds` | number | `event_counter` | Fenêtre de comptage en secondes (défaut 60) |
| `windowSize` | number | `trend` / `moving_average` | Nombre de valeurs dans la fenêtre (défaut 10) |

**Opérations disponibles**

| Opération | Ce que ça calcule |
|---|---|
| `stats` | min, max, avg, median, stddev, p95 sur le tableau d'entrée |
| `station_stats` | min/max/avg des lastReading de tous les capteurs d'une station |
| `event_counter` | Compte les items du tableau, route si count ≥ countThreshold |
| `trend` | Régression linéaire sur les N dernières valeurs → direction |
| `moving_average` | Moyenne des windowSize dernières valeurs |

**Ports de sortie**

| Port | Opération | Contenu |
|---|---|---|
| `out` | `stats` / `moving_average` / `station_stats` | Résultat numérique agrégé |
| `out` / `threshold_reached` | `event_counter` | `{ count, threshold, thresholdReached }` |
| `rising` / `falling` / `stable` | `trend` | `{ slope, direction, windowSize }` |
| `error` | toutes | En cas d'entrée invalide |

> ⚠️ `time_average`, `rolling_average`, `rate_of_change`, `percentile` de la
> documentation précédente n'existent **pas**.  
> Équivalents : `time_average` → `stats` (avg) · `rolling_average` → `moving_average`
> · `percentile` → `stats` (p95) · `rate_of_change` → bloc `sensor-check`.

---

### 2.4 `stream-filter`

**Ce que ça fait**  
Pré-traite un tableau d'événements capteur en réduisant le bruit, rejetant les
pics, lissant, ou détectant des rafales (bursts) avant d'atteindre un bloc de
décision.

**Quand l'utiliser**  
Entre `sensor-read (history)` et tout bloc décision/sortie quand le signal brut
est bruité (capteurs de vibration, débitmètres avec chocs hydrauliques).

> ⚠️ Ce bloc travaille sur des **tableaux**. En entrée scalaire, il passe la
> valeur directement. Connecter la sortie `readings` de `sensor-read (history)`.

**Propriétés**

| Propriété | Type | Opération | Description |
|---|---|---|---|
| `operation` | select | toujours | `debounce` · `throttle` · `sample` · `burst_detect` |
| `intervalMs` | number | `debounce` / `throttle` | Intervalle en millisecondes (défaut 500) |
| `sampleEvery` | number | `sample` | Garder 1 item sur N (défaut 5) |
| `burstCount` | number | `burst_detect` | Seuil de nombre d'items déclenchant burst (défaut 10) |
| `burstWindowMs` | number | `burst_detect` | Fenêtre temporelle en ms (défaut 1000) |

**Opérations disponibles**

| Opération | Ce que ça fait |
|---|---|
| `debounce` | Collapse le tableau à la valeur la plus récente (index 0) |
| `throttle` | Garde le 1er item de chaque fenêtre de N items |
| `sample` | Retourne 1 item sur N (downsampling) |
| `burst_detect` | Déclenche le port `burst` si count ≥ burstCount |

**Ports de sortie**

| Port | Opération | Condition |
|---|---|---|
| `fired` | `debounce` / `sample` | Toujours |
| `allowed` | `throttle` | Toujours |
| `burst` | `burst_detect` | count ≥ burstCount |
| `normal` | `burst_detect` | count < burstCount |

> ⚠️ Les ports `filtered` et `rejected` de la documentation précédente
> n'existent **pas**.  
> Le port de burst s'appelle `burst` (pas `rejected`).

---

### 2.5 `data-output`

**Ce que ça fait**  
Écrit des données traitées vers une destination persistante : le log AquaFlow,
la table time-series `sensor_data`, un export CSV, ou un webhook externe.

**Quand l'utiliser**  
Toujours à la **fin** d'une branche d'analyse quand on veut enregistrer le
résultat pour audit, reporting, ou intégration tierce.

**Propriétés**

| Propriété | Type | Opération | Description |
|---|---|---|---|
| `operation` | select | toujours | `log` · `store` · `export_csv` · `webhook` |
| `label` | string | `log` | Label humain pour l'entrée log |
| `tags` | string | `log` | Tableau JSON de tags : `["pressure","station-1"]` |
| `sensorId` | select | `store` | Capteur recevant le nouvel enregistrement |
| `filename` | string | `export_csv` | Nom du fichier CSV (sauvegardé dans MinIO) |
| `webhookUrl` | string | `webhook` | URL cible (POST avec corps JSON) |
| `headers` | string | `webhook` | Objet JSON d'en-têtes HTTP personnalisés |

**Port de sortie**

| Port | Contenu |
|---|---|
| `done` | Entrée originale + `{ outputOperation, writtenAt }` |

---

## 3. Bloc de calcul personnalisé

---

### 3.1 `custom-calc`

**Ce que ça fait**  
Récupère jusqu'à quatre séries temporelles de capteurs indépendants depuis la
base de données, les aligne sur une grille temporelle commune, évalue une
formule mathjs définie par l'utilisateur, et retourne un résultat scalaire agrégé.

**Quand l'utiliser**  
- Indice de qualité de l'eau combinant turbidité, pH et chlore
- Pression différentielle entre deux points de mesure
- Ratio d'efficacité énergétique : débit / consommation
- Toute formule multi-variable impossible à exprimer avec un seul `value-transform`

**Propriétés**

| Propriété | Type | Requis | Description |
|---|---|---|---|
| `formula` | string | ✓ | Expression mathjs utilisant `a`, `b`, `c`, `d` comme noms de variables |
| `sensorIdA` | select | ✓ | Capteur mappé à la variable `a` |
| `sensorIdB` | select | | Capteur mappé à la variable `b` |
| `sensorIdC` | select | | Capteur mappé à la variable `c` |
| `sensorIdD` | select | | Capteur mappé à la variable `d` |
| `timeMode` | select | ✓ | `last_n_minutes` · `absolute` |
| `periodMinutes` | number | `last_n_minutes` | Fenêtre rétrospective en minutes |
| `startDate` | datetime-local | `absolute` | Début de la plage temporelle |
| `endDate` | datetime-local | `absolute` | Fin de la plage temporelle |
| `resampleStrategy` | select | ✓ | `interpolate` · `forward_fill` · `downsample` |
| `downsampleAgg` | select | `downsample` | `mean` · `min` · `max` · `sum` |
| `aggregation` | select | ✓ | `mean` · `min` · `max` · `sum` · `last` |

**Stratégies d'alignement temporel**

| Stratégie | Comportement |
|---|---|
| `interpolate` | Interpolation linéaire de chaque série sur une grille 1-minute |
| `forward_fill` | Propage la dernière valeur connue pour combler les lacunes |
| `downsample` | Regroupe les lectures en buckets 1-minute et applique `downsampleAgg` |

**Port de sortie**

| Port | Contenu |
|---|---|
| `result` | `{ value: <scalaire>, formula, variables: { a, b, c, d }, aggregation, computedAt }` |

**Exemples de formules**

```
a - b                          # pression différentielle (capteur A moins B)
(a + b + c) / 3                # moyenne simple de trois capteurs
(a / b) * 100                  # ratio en pourcentage
sqrt(a^2 + b^2)                # combinaison euclidienne
clamp(a * 0.0625 - 2.5, 0, 10) # 4-20mA vers 0-10 bar, balisé
```

> **Sécurité :** les formules sont évaluées avec `mathjs evaluate()` —
> `eval()` n'est jamais utilisé et aucun code JavaScript ne peut être injecté.

---

## 4. Scénarios combinés

---

### Scénario A — Détection surpression & arrêt automatique

**Objectif :** Lire la pression de refoulement de la pompe P-01 sur les 5
dernières minutes. Si la moyenne dépasse 8,5 bar, arrêter la pompe et créer
une alerte critique.

**Blocs utilisés :** `sensor-read (history)` → `data-aggregate (stats)` →
`threshold-check` → `pump-control` + `alert-trigger`

```
[sensor-read]
  operation:  history
  sensorId:   pression-refoulement-p01
  timeRange:  last_hour
  limit:      10
        |
        | readings  (tableau des dernières lectures)
        ▼
[data-aggregate]
  operation:  stats
        |
        | out  { avg: 8.72, min: ..., max: ..., ... }
        ▼
[threshold-check]
  mode:         above_max
  maxThreshold: 8.5
        |              |
      pass           breach
        |                \——— rien (pression normale)
        ▼
  ┌─────────────────────┐
  │   [pump-control]    │──done──▶ [alert-trigger]
  │   station: P-01     │          title: "Surpression pompe P-01"
  │   command: stop     │          message: "Pression moy {{value}} bar > 8.5 bar"
  └─────────────────────┘          severity: critical
```

**Interprétation :**
- `sensor-read (history)` récupère les 10 dernières lectures de la dernière heure.
- `data-aggregate (stats)` calcule min/max/avg/stddev — le champ `avg` est utilisé en aval.
- `threshold-check (above_max, 8.5)` branche sur `breach` si avg > 8.5.
- La branche `breach` déclenche `pump-control` (arrêt via MQTT) et `alert-trigger` (alerte critique sur le dashboard).

---

### Scénario B — Rapport journalier débit + log anomalie

**Objectif :** Calculer la moyenne du débit sur les dernières 24h. Si elle
s'écarte de plus de 20 % par rapport à la tendance sur 7 jours, logger une
anomalie avec des tags.

**Blocs utilisés :** `sensor-read (history, 24h)` → `data-aggregate (stats)`
→ `sensor-read (history, 7j)` → `data-aggregate (stats)` → `sensor-check (compare)`
→ `data-output (log)`

```
[sensor-read]                     [sensor-read]
  operation: history                operation: history
  sensorId: debit-principal         sensorId: debit-principal
  timeRange: last_24h               timeRange: last_week
        |                                 |
        | readings                        | readings
        ▼                                 ▼
[data-aggregate]                  [data-aggregate]
  operation: stats                  operation: stats
        |                                 |
        | out.avg (moy. 24h)             | out.avg (moy. 7j)
        ▼                                 ▼

         [data-transform: set_field]   ← fusionner les deux avg
           set valueA = moy24h
           set valueB = moy7j * 1.2
                    |
                    ▼
             [sensor-check]
               operation: compare
               tolerance: 0.01
                    |             |
              a_greater        b_greater / equal
                    |
                    ▼
             [data-output]
               operation: log
               label: "Anomalie débit détectée"
               tags: ["debit","anomalie","rapport-journalier"]
```

**Note :** Le bloc `data-transform (set_field)` est nécessaire pour construire
l'objet `{ valueA, valueB }` attendu par `sensor-check (compare)`.

---

### Scénario C — Calcul dose chlore & commande MQTT

**Objectif :** Calculer la dose de chlore requise en fonction du débit et du
résiduel chloré actuel, puis publier le setpoint au contrôleur de la pompe
doseuse.

**Formule :** `dose = (0.5 - b) * a * 0.001`
- `a` = débit en m³/h
- `b` = résiduel chloré en mg/L
- Cible résiduelle = 0,5 mg/L, facteur de conversion = 0,001

**Blocs utilisés :** `custom-calc` → `value-transform (clamp)` → `mqtt-publish`

```
[custom-calc]
  formula:          "(0.5 - b) * a * 0.001"
  sensorIdA:        debit-principal          ← a
  sensorIdB:        chlore-residuel          ← b
  timeMode:         last_n_minutes
  periodMinutes:    10
  resampleStrategy: interpolate
  aggregation:      mean
        |
        | result
        ▼
[value-transform]
  operation: clamp
  min: 0          ← ne jamais injecter une dose négative
  max: 5          ← plafond de sécurité en kg/h
        |
        | result
        ▼
[mqtt-publish]
  topic:   "stations/usine-eau/dosage/setpoint"
  payload: '{"dose_kg_h": {{value}}, "source": "aquaflow-workflow"}'
  qos:     1
  retain:  true
```

**Interprétation :**
`custom-calc` récupère les 10 dernières minutes de débit et de chlore,
les aligne, évalue la formule. `value-transform` bride le résultat à une
plage sûre avant envoi MQTT.

---

### Scénario D — Contrôle qualité multi-capteurs

**Objectif :** Avant de libérer l'eau traitée vers le réseau de distribution,
vérifier que le pH est entre 6,5 et 8,5 ET la turbidité est inférieure à 1 NTU.
Si les deux conditions sont OK, ouvrir la vanne de sortie. Sinon, déclencher
une alerte.

**Blocs utilisés :** `sensor-read` ×2 → `threshold-check` ×2 →
`data-transform (set_field)` → `sensor-check (compare)` → `pump-control` /
`alert-trigger`

```
[sensor-read: pH]                [sensor-read: turbidité]
  operation: single                operation: single
        |                                |
        | value (ex: 7.2)               | value (ex: 0.8)
        ▼                                ▼
[threshold-check: pH]            [threshold-check: turbidité]
  mode: between                    mode: above_max
  minThreshold: 6.5                maxThreshold: 1.0
  maxThreshold: 8.5
        |        |                       |          |
      pass    breach                   pass       breach
        |                               |
        └──────────┬────────────────────┘
                   ▼
     [data-transform: set_field]   ← construit { valueA, valueB }
       set valueA = pH_ok (1 si pass, 0 si breach)
       set valueB = 1
                   |
                   ▼
            [sensor-check]
              operation: compare
                   |               |
             a_greater          b_greater
             (les deux OK)      (au moins un KO)
                   |                  |
                   ▼                  ▼
            [pump-control]     [alert-trigger]
              command: start     title: "Échec contrôle qualité"
              (ouvrir vanne)     severity: critical
```

> **Note :** Pour la logique AND, chaque `threshold-check` connecte son port
> `pass` à 1 et `breach` à 0 via `data-transform`, puis `sensor-check (compare)`
> vérifie que les deux valeurs sont égales à 1.

---

### Scénario E — Alerte précoce rupture de canalisation

**Objectif :** Surveiller un capteur de débit pour des pics haute fréquence
indiquant une rupture de canalisation, puis envoyer une notification webhook
et passer la station en mode maintenance.

**Blocs utilisés :** `sensor-read (history)` → `stream-filter (burst_detect)`
→ `data-output (webhook)` → `station-control`

```
[sensor-read]
  operation: history
  sensorId:  debit-distribution-nord
  timeRange: last_hour
  limit:     50
        |
        | readings   (tableau des lectures)
        ▼
[stream-filter]
  operation:    burst_detect
  burstCount:   8       ← 8 lectures ou plus = rafale
  burstWindowMs: 5000   ← fenêtre 5 secondes
        |              |
      normal          burst   (rafale détectée)
                        |
                        ▼
                [data-output]
                  operation:  webhook
                  webhookUrl: "https://hooks.example.com/pipe-alert"
                  headers: '{"Authorization":"Bearer <token>"}'
                        |
                      done
                        |
                        ▼
                [station-control]
                  stationId:    district-nord
                  targetStatus: maintenance
                  reason:       "Rupture canalisation détectée par workflow"
```

**Interprétation :**
Quand `stream-filter` détecte une rafale (count ≥ burstCount), il route vers
le port `burst`. Le webhook poste un JSON vers un service externe (Zapier,
Teams, SMS gateway). `station-control` isole immédiatement la station.

---

## Tableau récapitulatif

| Bloc | Catégorie | Usage principal | Ports de sortie clés |
|---|---|---|---|
| `sensor-read` | Base | Lire données capteur en direct/historique | `value` · `readings` · `sensors` · `online`/`offline` · `significant`/`stable` |
| `threshold-check` | Base | Branching binaire sur une valeur | `pass` · `breach` |
| `alert-trigger` | Base | Créer une alerte DB + notification temps réel | `triggered` |
| `mqtt-publish` | Base | Envoyer commande MQTT brute | `sent` |
| `pump-control` | Base | Démarrer/arrêter/régler pompe AquaFlow | `done` |
| `station-control` | Base | Changer le statut opérationnel d'une station | `done` |
| `value-transform` | Étendu | Convertir / brider / normaliser une valeur | `result` |
| `sensor-check` | Étendu | Conditions multi-modes (6 opérations) | selon opération |
| `data-aggregate` | Étendu | Réduction statistique d'une série temporelle | `out` · `rising`/`falling`/`stable` · `threshold_reached` |
| `stream-filter` | Étendu | Réduction bruit / détection rafale | `fired` · `allowed` · `burst` · `normal` |
| `data-output` | Étendu | Persister / exporter / webhook | `done` |
| `custom-calc` | Personnalisé | Formule multi-capteurs (mathjs) | `result` |

---

## Corrections par rapport à la version 1

| Bloc | Ce qui a changé |
|---|---|
| `sensor-read` | Opérations : `single` (pas `latest`), `history`, `batch`, `status_check`, `delta`. Supprimé : `average`, `min`, `max` |
| `threshold-check` | Propriétés : `minThreshold`/`maxThreshold`/`mode`. Ports : `pass`/`breach` (pas `above`/`below`). Mode `between` détecte les violations dans les deux directions |
| `sensor-check` | Opérations : `multi_threshold`, `rate_of_change`, `deadband`, `anomaly`, `compare`, `time_window`. Supprimé : `above`, `below`, `between`, `outside`, `equals` |
| `data-aggregate` | Opérations : `stats`, `station_stats`, `event_counter`, `trend`, `moving_average`. Supprimé : `time_average`, `rolling_average`, `rate_of_change`, `percentile` |
| `stream-filter` | Propriété burst : `burstCount` (pas `burstThreshold`). Port burst : `burst` (pas `rejected`). Port normal : `normal` (pas `filtered`) |

---

*Document corrigé le 2026-06-09 — AquaFlow PFE Project*
