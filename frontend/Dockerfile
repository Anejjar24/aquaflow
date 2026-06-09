# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Build-time env vars (baked into the React bundle by CRA)
ARG REACT_APP_API_URL=http://localhost:3001/api
ARG REACT_APP_WS_URL=http://localhost:3001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL

COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ────────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Replace default nginx config with our SPA-aware one
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost/index.html | grep -q "AquaFlow\|root" || exit 1

CMD ["nginx", "-g", "daemon off;"]
