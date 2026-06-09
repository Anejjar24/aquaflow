# ── Stage 1: Build ──────────────────────────────────────────────────────────
# node:20-slim is Debian-based (glibc) — bcrypt pre-built binaries work here,
# no need for python3/make/g++ native compilation tools.
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Install wget (for healthcheck) + production dependencies
COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/* && \
    npm install --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN groupadd -r aquaflow && useradd -r -g aquaflow aquaflow
USER aquaflow

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health 2>/dev/null | grep -q '"status":"ok"' || exit 1

CMD ["node", "dist/main"]
