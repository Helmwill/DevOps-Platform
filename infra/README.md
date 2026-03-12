# Infra — Self-Hosted VPS DevOps Platform

All stacks run as Docker Compose services behind a shared Traefik reverse proxy.
No cloud IaC is used; everything runs on a single VPS (or a small cluster of VMs).

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **Docker** ≥ 24 | `curl -fsSL https://get.docker.com | sh` |
| **Docker Compose** v2 plugin | Bundled with Docker Desktop; on Linux: `apt install docker-compose-plugin` |
| **Domain name** | You must own a domain whose DNS you control |
| **DNS A records** | Point `gitea.<DOMAIN>`, `dashboard.<DOMAIN>`, and `traefik.<DOMAIN>` to your VPS public IP |
| **Ports 80 & 443 open** | Required for HTTP-01 ACME challenge and HTTPS traffic |
| **`htpasswd` utility** | `apt install apache2-utils` — used to generate basic-auth credential strings |

---

## Directory Layout

```
infra/
├── traefik/
│   └── docker-compose.yml   # Reverse proxy + TLS termination
├── gitea/
│   └── docker-compose.yml   # Git hosting + Actions runner
├── dashboard/
│   └── docker-compose.yml   # Custom web dashboard (placeholder image)
└── README.md                # This file
```

---

## Shared External Network

All stacks communicate with Traefik over a single external Docker network.
**Create it once before deploying any stack:**

```bash
docker network create traefik-public
```

---

## Environment Variables & Secrets

Never store secrets in the compose files themselves.
Use a `.env` file (excluded from version control) or a secrets manager.

### Global (all stacks)

| Variable | Description | Example |
|---|---|---|
| `DOMAIN` | Root domain for all subdomains | `example.com` |
| `ACME_EMAIL` | Email for Let's Encrypt registration | `ops@example.com` |

### Traefik stack

| Variable | Description | How to generate |
|---|---|---|
| `TRAEFIK_DASHBOARD_AUTH` | htpasswd string for dashboard basic-auth | `htpasswd -nb admin <password>` |

### Gitea stack

| Variable | Description | Notes |
|---|---|---|
| `GITEA_DB_PASSWORD` | PostgreSQL password for Gitea | Strong random string |
| `GITEA_DB_NAME` | Database name | Default: `gitea` |
| `GITEA_DB_USER` | Database user | Default: `gitea` |
| `GITEA_SECRET_KEY` | Gitea secret key | `openssl rand -hex 32` |
| `GITEA_INTERNAL_TOKEN` | Gitea internal token | `openssl rand -hex 32` |
| `GITEA_APP_NAME` | Display name for the Gitea instance | Default: `Gitea` |
| `GITEA_SSH_PORT` | Host port for git+ssh | Default: `2222` |
| `GITEA_RUNNER_TOKEN` | Runner registration token | Generated in Gitea admin UI |
| `GITEA_RUNNER_NAME` | Display name for the runner | Default: `vps-runner-01` |
| `GITEA_RUNNER_LABELS` | Runner label:image mappings | Default: `ubuntu-latest:docker://node:20-bullseye` |
| `GITEA_MAILER_ENABLED` | Enable Gitea mailer | Default: `false` |

### Dashboard stack

| Variable | Description | Notes |
|---|---|---|
| `REGISTRY_URL` | Container registry hostname | e.g. `registry.example.com` or `ghcr.io/org` |
| `IMAGE_TAG` | Dashboard image tag to deploy | e.g. `latest` or a SHA |
| `DASHBOARD_AUTH` | htpasswd string for dashboard basic-auth | `htpasswd -nb admin <password>` |
| `DASHBOARD_PORT` | Internal port the dashboard app listens on | Default: `3000` |

### Sample `.env` file (DO NOT commit this file)

```dotenv
# Global
DOMAIN=example.com
ACME_EMAIL=ops@example.com

# Traefik
TRAEFIK_DASHBOARD_AUTH=admin:$$apr1$$...   # escape $ signs with $$ in .env files

# Gitea
GITEA_DB_PASSWORD=changeme_strong_password
GITEA_SECRET_KEY=<openssl rand -hex 32 output>
GITEA_INTERNAL_TOKEN=<openssl rand -hex 32 output>
GITEA_RUNNER_TOKEN=<token from Gitea admin UI>

# Dashboard
REGISTRY_URL=ghcr.io/your-org
IMAGE_TAG=latest
DASHBOARD_AUTH=admin:$$apr1$$...
```

> **Tip:** In `.env` files, dollar signs inside htpasswd hashes must be escaped by
> doubling them (`$` → `$$`). On the command line they do not need escaping.

---

## Deployment Order

Stacks must be deployed in this exact order because later stacks depend on
the `traefik-public` network and on Traefik being ready to issue certificates.

### Step 1 — Create the shared network

```bash
docker network create traefik-public
```

### Step 2 — Deploy Traefik

```bash
cd infra/traefik
cp /path/to/your/.env .env      # or export variables in your shell
docker compose up -d
docker compose logs -f traefik  # watch for ACME certificate acquisition
```

Verify Traefik is running and its dashboard is reachable at `https://traefik.<DOMAIN>`
(protected by `TRAEFIK_DASHBOARD_AUTH`).

### Step 3 — Deploy Gitea

```bash
cd infra/gitea
cp /path/to/your/.env .env
docker compose up -d
docker compose logs -f gitea    # wait for "Starting new Web server"
```

1. Open `https://gitea.<DOMAIN>` in a browser and complete the initial setup wizard.
2. Create a site-admin account.
3. Navigate to **Site Administration → Runners → Create new runner** and copy the
   registration token into `GITEA_RUNNER_TOKEN` in your `.env`.
4. Restart the runner so it registers with the token:

```bash
docker compose restart gitea-runner
docker compose logs -f gitea-runner  # confirm "Runner registered successfully"
```

### Step 4 — Deploy the Dashboard

```bash
cd infra/dashboard
cp /path/to/your/.env .env
docker compose up -d
```

The dashboard will be available at `https://dashboard.<DOMAIN>` behind basic-auth.

> **Note:** The dashboard image (`${REGISTRY_URL}/dashboard:${IMAGE_TAG}`) is a
> placeholder. Replace it with the actual image once the Code Builder produces and
> pushes the dashboard image to your registry.

---

## Updating Stacks

Pull the latest images and recreate containers without downtime:

```bash
# For any stack directory:
docker compose pull
docker compose up -d --remove-orphans
```

---

## TLS / Let's Encrypt Notes

- Certificates are stored in the `traefik-acme` Docker volume (`/acme/acme.json`).
- The HTTP-01 challenge requires port 80 to be reachable from the internet.
- Let's Encrypt rate limits apply (50 certificates per registered domain per week).
  Use the staging CA during initial setup by adding
  `--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory`
  to the Traefik command, then remove it for production.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Certificate not issued | Port 80 blocked by firewall | Open port 80 on the VPS firewall |
| `traefik-public` network not found | Network not created before compose up | `docker network create traefik-public` |
| Gitea runner not registering | Wrong or expired `GITEA_RUNNER_TOKEN` | Re-generate token in Gitea admin UI |
| Dashboard returns 401 | Malformed `DASHBOARD_AUTH` | Re-run `htpasswd -nb` and double all `$` signs in `.env` |
| DNS not resolving | A records not propagated | Wait for TTL or check DNS with `dig gitea.<DOMAIN>` |
