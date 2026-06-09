"""
Generate figures/anomaly_feedback_loop.png
Run: pip install matplotlib && python docs/generate_anomaly_loop.py
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

os.makedirs("docs/figures", exist_ok=True)

# ── Palette ───────────────────────────────────────────────────────────────────
C_SENSOR   = "#4FC3F7"   # light blue  – physical layer
C_KAFKA    = "#FFB74D"   # orange      – Kafka topics
C_SPARK    = "#EF9A9A"   # red         – Spark processing
C_NESTJS   = "#A5D6A7"   # green       – NestJS backend
C_DB       = "#CE93D8"   # purple      – TimescaleDB
C_FRONTEND = "#80DEEA"   # teal        – Frontend / operator
C_ARROW_FW = "#455A64"   # dark grey   – forward flow
C_ARROW_FB = "#E53935"   # red         – feedback / alert flow
BG         = "#FAFAFA"

fig, ax = plt.subplots(figsize=(14, 8))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 14)
ax.set_ylim(0, 8)
ax.axis("off")

# ── Helper ────────────────────────────────────────────────────────────────────
def box(ax, x, y, w, h, color, title, subtitle="", radius=0.3, fontsize=9):
    bb = FancyBboxPatch((x, y), w, h,
                        boxstyle=f"round,pad=0.05,rounding_size={radius}",
                        linewidth=1.5, edgecolor="#37474F",
                        facecolor=color, zorder=3)
    ax.add_patch(bb)
    cy = y + h / 2
    if subtitle:
        ax.text(x + w/2, cy + 0.18, title,
                ha="center", va="center", fontsize=fontsize,
                fontweight="bold", zorder=4)
        ax.text(x + w/2, cy - 0.22, subtitle,
                ha="center", va="center", fontsize=7.5,
                color="#37474F", zorder=4)
    else:
        ax.text(x + w/2, cy, title,
                ha="center", va="center", fontsize=fontsize,
                fontweight="bold", zorder=4)

def arrow(ax, x1, y1, x2, y2, color=C_ARROW_FW, label="", lw=1.8,
          style="->", rad=0.0):
    ax.annotate("",
                xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color,
                                lw=lw, connectionstyle=f"arc3,rad={rad}"),
                zorder=5)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.18, label,
                ha="center", va="bottom", fontsize=7.5,
                color=color, fontweight="bold", zorder=6,
                bbox=dict(boxstyle="round,pad=0.1", fc=BG, ec="none", alpha=0.8))

# ── Title ─────────────────────────────────────────────────────────────────────
ax.text(7, 7.6, "Boucle de Feedback Anomalie — AquaFlow",
        ha="center", va="center", fontsize=13, fontweight="bold", color="#1A237E")
ax.text(7, 7.25, "De la détection Spark à la notification opérateur (latence < 6 s)",
        ha="center", va="center", fontsize=9, color="#455A64")

# ── LAYER LABELS ──────────────────────────────────────────────────────────────
for label, ypos in [("① Ingestion", 5.85), ("② Transport", 4.35),
                    ("③ Détection", 3.0), ("④ Alerte", 1.5)]:
    ax.text(0.15, ypos, label, ha="left", va="center", fontsize=8,
            color="#78909C", style="italic")

# ── BOXES ─────────────────────────────────────────────────────────────────────
# Row 1 — ingestion
box(ax, 1.0, 5.5, 2.2, 0.9, C_SENSOR,  "Capteur Physique",  "MQTT → Mosquitto")
box(ax, 4.2, 5.5, 2.8, 0.9, C_NESTJS,  "IoT Service",       "NestJS / MQTT sub")
box(ax, 8.2, 5.5, 2.2, 0.9, C_DB,      "TimescaleDB",       "sensor_data (hypertable)")

# Row 2 — Kafka forward
box(ax, 4.2, 4.0, 2.8, 0.9, C_KAFKA,   "sensors.readings",  "Kafka topic (3 partitions)")

# Row 3 — Spark
box(ax, 3.5, 2.6, 4.2, 0.95, C_SPARK,
    "Spark Structured Streaming",
    "Z-score / fenêtre 5 min / seuil ≥ 2.5")

# Row 3 right — anomaly topic
box(ax, 8.8, 2.6, 2.5, 0.95, C_KAFKA,  "sensors.anomalies", "Kafka topic")

# Row 4 — NestJS consumer + DB + Frontend
box(ax, 1.0, 1.1, 2.8, 0.9, C_NESTJS,  "KafkaConsumerService", "NestJS consumer group")
box(ax, 4.5, 1.1, 2.5, 0.9, C_DB,      "TimescaleDB",       "alerts table")
box(ax, 7.8, 1.1, 2.8, 0.9, C_FRONTEND,"Dashboard Frontend", "Socket.IO → React")
box(ax, 11.2,1.1, 1.8, 0.9, C_FRONTEND,"Opérateur",         "alerte < 6 s")

# ── FORWARD ARROWS (grey) ──────────────────────────────────────────────────────
# Capteur → IoT Service
arrow(ax, 3.2, 5.95, 4.2, 5.95, label="MQTT pub")
# IoT → TimescaleDB
arrow(ax, 7.0, 5.95, 8.2, 5.95, label="TypeORM save")
# IoT → sensors.readings
arrow(ax, 5.6, 5.5, 5.6, 4.9, label="publish")
# sensors.readings → Spark
arrow(ax, 5.6, 4.0, 5.6, 3.55, label="consume")
# Spark → sensors.anomalies
arrow(ax, 7.7, 3.08, 8.8, 3.08, label="publish anomaly")
# sensors.anomalies → KafkaConsumerService
arrow(ax, 9.0, 2.6, 2.4, 2.0, label="consume", color=C_ARROW_FB, rad=0.15)

# ── FEEDBACK ARROWS (red) ─────────────────────────────────────────────────────
# KafkaConsumerService → TimescaleDB alerts
arrow(ax, 3.8, 1.55, 4.5, 1.55, color=C_ARROW_FB, label="create alert")
# TimescaleDB → Frontend
arrow(ax, 7.0, 1.55, 7.8, 1.55, color=C_ARROW_FB, label="Socket.IO")
# Frontend → Opérateur
arrow(ax, 10.6, 1.55, 11.2, 1.55, color=C_ARROW_FB, label="notification")

# ── LEGEND ────────────────────────────────────────────────────────────────────
legend_items = [
    mpatches.Patch(color=C_ARROW_FW, label="Flux de données (forward)"),
    mpatches.Patch(color=C_ARROW_FB, label="Flux d'alerte (feedback)"),
    mpatches.Patch(color=C_SENSOR,   label="Couche capteur / IoT"),
    mpatches.Patch(color=C_KAFKA,    label="Apache Kafka"),
    mpatches.Patch(color=C_SPARK,    label="Apache Spark Streaming"),
    mpatches.Patch(color=C_NESTJS,   label="NestJS Backend"),
    mpatches.Patch(color=C_DB,       label="TimescaleDB"),
    mpatches.Patch(color=C_FRONTEND, label="Frontend / Opérateur"),
]
ax.legend(handles=legend_items, loc="lower right", fontsize=7.5,
          framealpha=0.9, ncol=2, bbox_to_anchor=(1.0, 0.0))

plt.tight_layout()
plt.savefig("docs/figures/anomaly_feedback_loop.png", dpi=180, bbox_inches="tight")
print("✅  Sauvegardé : docs/figures/anomaly_feedback_loop.png")
