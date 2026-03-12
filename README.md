# VPS Self-Hosted DevOps Platform

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
Traefik (ports 80/443)          infra/traefik/
   |  Reverse proxy, TLS termination, HTTP->HTTPS redirect
   |  Subdomains: traefik.<DOMAIN>
   |
   +-> Dashboard                infra/dashboard/
          Custom web dashboard (read-only Docker socket)
          Subdomains: dashboard.<DOMAIN>

All services communicate over the shared `traefik-public` Docker bridge network.
CI/CD pipelines run on GitHub Actions (GitHub-hosted runners); deployments are
pushed to the VPS via SSH using secrets stored in GitHub repository settings.
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

1. **Prerequisites** -- see [infra/README.md](infra/README.md#prerequisites) for the
   full list (Docker >= 24, domain name, DNS A records, open ports 80/443).

2. **Create the shared network:**

   ```bash
   docker network create traefik-public
   ```

3. **Prepare your secrets** -- copy or create a `.env` file in each stack directory.
   Never commit secrets. See [infra/README.md](infra/README.md#environment-variables--secrets)
   for the full variable reference.

4. **Deploy in order:**

   ```bash
   # 1. Traefik first -- it must be up before any other stack
   cd infra/traefik && docker compose up -d

   # 2. Dashboard
   cd infra/dashboard && docker compose up -d
   ```

For complete deployment instructions, troubleshooting, and TLS notes see
**[infra/README.md](infra/README.md)**.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Detailed architecture decisions and component interactions |
| [docs/sprint-plan.md](docs/sprint-plan.md) | Sprint plan and story breakdown |
| [infra/README.md](infra/README.md) | Full deployment guide, environment variables, troubleshooting |
