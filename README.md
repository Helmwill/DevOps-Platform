# VPS Self-Hosted DevOps Platform

[![PR Gate](https://github.com/Helmwill/DevOps-Platform/actions/workflows/pr-gate.yml/badge.svg?branch=main)](https://github.com/Helmwill/DevOps-Platform/actions/workflows/pr-gate.yml)
[![Deploy Dev](https://github.com/Helmwill/DevOps-Platform/actions/workflows/deploy-dev.yml/badge.svg)](https://github.com/Helmwill/DevOps-Platform/actions/workflows/deploy-dev.yml)
[![Deploy Prod](https://github.com/Helmwill/DevOps-Platform/actions/workflows/deploy-prod.yml/badge.svg)](https://github.com/Helmwill/DevOps-Platform/actions/workflows/deploy-prod.yml)

A fully self-hosted DevOps platform running on a single VPS (or small cluster of VMs).
It combines a Traefik reverse proxy, GitHub Actions CI/CD, and a custom web dashboard —
all wired together over a shared Docker network with automatic TLS via Let's Encrypt.
No cloud IaC required. Source control and CI/CD pipelines run on GitHub.

---

## Architecture Overview

```
Internet
   |
   v
Traefik (ports 80/443)              infra/traefik/
   |  Reverse proxy, TLS termination, HTTP→HTTPS redirect
   |  Subdomain: traefik.<DOMAIN>
   |
   +-> Dashboard (prod)             prod/docker-compose.yml
   |      backend (Node.js) + frontend (nginx)
   |      Subdomain: dashboard.<DOMAIN>
   |      Deployed via deploy-prod.yml automatically after QA passes
   |
   +-> Dashboard (qa)               qa/docker-compose.yml
   |      Ephemeral slot — spun up for the QA gauntlet, torn down after prod
   |      Subdomain: qa.<DOMAIN>
   |
   +-> Dashboard (dev)              dev/docker-compose.yml
          Persistent redeploy slot — updated on every push to `dev` branch
          Subdomain: dev.<DOMAIN>

All services communicate over the shared `traefik-public` Docker bridge network.

CI/CD pipeline: push to `dev` → build images → deploy-dev → deploy-qa (gauntlet) →
                deploy-prod (manual gate: Helmwill) → teardown-qa
```

---

## Network Naming Conventions

### `traefik-public`

| Property | Value |
|---|---|
| Type | External Docker bridge network |
| Scope | Shared by all stacks |
| Purpose | Allows Traefik to discover and route to containers |

This network is declared **external** in every sub-stack compose file, meaning Docker
Compose will not create or destroy it automatically. It must exist before any stack is
started.

**Why external?**
Keeping the network external prevents accidental deletion when a single stack is torn
down (`docker compose down`). Traefik and all backend services must share the same
network for Traefik to reach them; a named external network is the standard pattern
for multi-stack Compose setups.

**Create the network once before deploying anything:**

```bash
docker network create traefik-public
```

If you attempt to bring up any stack before creating the network you will see:


```
network traefik-public declared as external, but could not be found
```
---

## Quick Start

1. **Prerequisites** — see [infra/README.md](infra/README.md#prerequisites) for the
   full list (Docker >= 24, domain name, DNS A records, open ports 80/443).

2. **Create the shared network (once, on the VPS):**

   ```bash
   docker network create traefik-public
   ```

3. **Deploy Traefik (once, on the VPS):**

   ```bash
   cd infra/traefik && docker compose up -d
   ```

4. **Configure GitHub secrets** in repository/environment settings — see
   [infra/README.md](infra/README.md#environment-variables--secrets) for the full variable list.
   Environments required: `dev`, `qa`, `production`.

5. **Push to `dev`** — the CI/CD pipeline handles everything from here:
   - Builds backend + frontend Docker images (tagged with git SHA)
   - Deploys to `dev` slot → runs QA gauntlet → deploys to `prod` automatically

> **Note:** The `dev/`, `qa/`, and `prod/` directories contain the Docker Compose files for each
> environment slot. They are deployed by the GitHub Actions workflows, not manually.

For complete deployment instructions, troubleshooting, and TLS notes see
**[infra/README.md](infra/README.md)**.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Detailed architecture decisions and component interactions |
| [docs/sprint-plan.md](docs/sprint-plan.md) | Sprint plan and story breakdown |
| [infra/README.md](infra/README.md) | Full deployment guide, environment variables, troubleshooting |giut comm