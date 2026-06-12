# AquaFlow CI/CD Setup Guide

## What works immediately (no setup required)

These pipeline stages run automatically on every push — zero configuration needed:

| Stage | What runs |
|---|---|
| Backend CI | TypeScript build → Trivy scan → 141 unit tests → 22 integration tests → Docker build+push to GHCR |
| Frontend CI | React build → Jest tests → Trivy scan → Docker build+push to GHCR |
| Python CI | Flake8 lint → 57 pytest tests → Trivy scan → Docker build+push to GHCR |

## Optional features — add secrets to enable

### 1. SonarQube Quality Gate

1. Create a SonarCloud account at https://sonarcloud.io
2. Import your GitHub repository
3. Get the `SONAR_TOKEN` from SonarCloud
4. Add to GitHub: **Settings → Secrets → Actions**:
   - `SONAR_TOKEN` = your token
   - `SONAR_HOST_URL` = `https://sonarcloud.io`
5. Add repository variable: **Settings → Variables → Actions**:
   - `SONAR_ENABLED` = `true`

### 2. Staging Deployment (SSH)

1. Set up a server with Docker and Docker Compose installed
2. Clone the repo to `/opt/aquaflow` on the server
3. Copy `.env.example` to `/opt/aquaflow/.env.staging` and fill in values
4. Add to GitHub Secrets:
   - `STAGING_SSH_KEY` = private SSH key for the server
   - `STAGING_USER` = SSH username (e.g. `ubuntu`)
   - `STAGING_HOST` = server IP or hostname
5. Add repository variable:
   - `STAGING_DEPLOY_ENABLED` = `true`
6. In GitHub: **Settings → Environments → Create** environment named `staging`

### 3. Production Deployment

Same as staging, but with:
- Secrets: `PROD_SSH_KEY`, `PROD_USER`, `PROD_HOST`
- Variable: `PROD_DEPLOY_ENABLED` = `true`
- In GitHub: **Settings → Environments → Create** environment named `production`
- **Enable "Required reviewers"** — this creates the manual approval gate

### 4. Frontend API URLs (build-time config)

Add repository **Variables** (not secrets — they're public URLs):
- `REACT_APP_API_URL` = `https://your-api-domain.com/api`
- `REACT_APP_WS_URL` = `https://your-api-domain.com`

## Image registry (GHCR)

Images are pushed automatically to GitHub Container Registry:

```
ghcr.io/YOUR-ORG/YOUR-REPO/backend:sha-abc1234
ghcr.io/YOUR-ORG/YOUR-REPO/frontend:sha-abc1234
ghcr.io/YOUR-ORG/YOUR-REPO/data-pipeline:sha-abc1234
ghcr.io/YOUR-ORG/YOUR-REPO/spark-jobs:sha-abc1234
```

After a successful production deploy, images are also tagged `:stable` for rollback.

## Pipeline flow

```
git push → Backend CI  ─┐
           Frontend CI  ─┼─► all pass? → CD pipeline → staging → smoke tests → production
           Python CI    ─┘
```
