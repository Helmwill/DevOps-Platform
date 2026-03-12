# Sprint Plan — VPS Self-Hosted DevOps Platform

**Project:** proj_vps_devops_platform
**Approver:** Helmwill
**Budget:** $0 (fully self-hosted, no cloud)
**Sprint cadence:** 2 weeks per sprint
**Concurrency default:** 2 stories in parallel
**Plan date:** 2026-03-12

---

## Table of Contents

1. [Definition of Done](#definition-of-done)
2. [Epic 1 — Foundation](#epic-1--foundation)
3. [Epic 2 — Dashboard Backend](#epic-2--dashboard-backend)
4. [Epic 3 — Dashboard Frontend](#epic-3--dashboard-frontend)
5. [Epic 4 — Auth & Security](#epic-4--auth--security)
6. [Epic 5 — CI/CD Pipeline](#epic-5--cicd-pipeline)
7. [Epic 6 — Observability](#epic-6--observability)
8. [Dependency Graph](#dependency-graph)
9. [Sprint Breakdown](#sprint-breakdown)
10. [Total Story Points](#total-story-points)

---

## Definition of Done

Every story must satisfy all criteria below before it is considered complete:

- [ ] All acceptance criteria for the story pass
- [ ] All 5 gauntlet stages green (T1 unit, T2 SAST, T3 IaC, T4 DAST/perf, T5 policy gate)
- [ ] No CRITICAL or HIGH findings left open without a human waiver
- [ ] Code delivered via PR — never a direct push to `main`
- [ ] PR reviewed and merged by approver (Helmwill) or a delegated agent after human gate `story_pr_merge`
- [ ] Changes reflected in `docs/execution-log.json`
- [ ] No credentials appear anywhere in code, logs, or PR diff (Gitleaks clean)
- [ ] Service is reachable via Traefik subdomain where applicable
- [ ] Docker Compose file passes Trivy IaC scan (no HIGH findings)
- [ ] Unit/integration test coverage >= 80 % for any new Node.js code
- [ ] README or inline comments updated where architectural decisions are made

---

## Epic 1 — Foundation

Stands up the core networking and service infrastructure. All other epics depend on at least one story here.

---

### Story 1.1 — Docker Network & Compose Scaffold

- **Points:** 3
- **Acceptance:**
  - A `docker-compose.yml` (or `compose/` directory) exists at the repo root with a named external Docker network (`platform-net`).
  - The file passes `docker compose config` with no errors.
  - Trivy IaC scan reports zero HIGH or CRITICAL findings against the Compose file.
  - A `README` section documents network naming conventions.
- **Assigned agent:** Infra
- **Depends on:** none
- **Parallel safe:** yes

---

### Story 1.2 — Traefik Reverse Proxy with Let's Encrypt SSL

- **Points:** 5
- **Acceptance:**
  - Traefik v2+ deployed via Docker Compose, attached to `platform-net`.
  - ACME (Let's Encrypt) resolver configured for the target domain; certificates auto-renew.
  - HTTP → HTTPS redirect middleware applied globally.
  - Traefik dashboard disabled or protected; not publicly accessible.
  - `https://traefik.domain.com` (or equivalent internal route) returns a valid TLS certificate.
  - Compose file passes Trivy IaC scan at HIGH threshold.
- **Assigned agent:** Infra
- **Depends on:** 1.1
- **Parallel safe:** no

---

### Story 1.3 — Gitea SCM Stack (Git + Registry + Actions Runner)

- **Points:** 5
- **Acceptance:**
  - Gitea deployed via Docker Compose with persistent volume for repos and data.
  - Built-in container registry enabled and reachable at `registry.domain.com` via Traefik.
  - At least one Gitea Actions runner registered and in `online` state.
  - `https://git.domain.com` resolves with valid TLS certificate.
  - Admin account creation completed through human gate `credential_actions` (agent does NOT store the password).
  - Repository `devops-platform/dashboard` created in Gitea.
- **Assigned agent:** Infra
- **Depends on:** 1.2
- **Parallel safe:** no

---

### Story 1.4 — Environment Routing (dev / QA / prod Compose profiles)

- **Points:** 3
- **Acceptance:**
  - Compose profiles (`dev`, `qa`, `prod`) defined; each profile maps to a distinct Traefik router rule (e.g. `dev.domain.com`, `qa.domain.com`, `dashboard.domain.com`).
  - `dev` profile redeploys on image push without requiring a full stack restart.
  - `qa` profile can be spun up and torn down idempotently via `docker compose --profile qa up -d` / `down`.
  - `prod` profile requires the `execute_command` human gate before first deploy.
  - All three routes respond with valid TLS on their respective subdomains.
- **Assigned agent:** Infra
- **Depends on:** 1.3
- **Parallel safe:** no

---

## Epic 2 — Dashboard Backend

Node.js (TypeScript) API server that exposes Docker state and system metrics.

---

### Story 2.1 — Node.js Project Scaffold & Docker Socket Client

- **Points:** 3
- **Acceptance:**
  - TypeScript project bootstrapped under `dashboard/backend/` with `tsconfig.json`, `package.json`, ESLint, and Prettier configured.
  - `dockerode` (or equivalent) library integrated; client connects to `/var/run/docker.sock`.
  - Health endpoint `GET /health` returns `{ status: "ok" }` with HTTP 200.
  - Dockerfile for the backend passes Trivy image scan (no HIGH/CRITICAL CVEs in base image).
  - Unit test coverage >= 80 % on any business-logic modules (socket client abstraction).
- **Assigned agent:** Code Builder
- **Depends on:** 1.1
- **Parallel safe:** yes

---

### Story 2.2 — Container List Endpoint

- **Points:** 3
- **Acceptance:**
  - `GET /api/containers` returns a JSON array with fields: `id`, `name`, `image`, `status` (`running` | `stopped` | `errored`), `created`.
  - Errored containers (exit code != 0 and not running) are correctly labelled `errored`.
  - Endpoint handles Docker daemon unavailability with HTTP 503 and structured error body.
  - Integration test covers running, stopped, and errored container scenarios using a mock Docker socket.
  - Response time p99 < 200 ms under 10 concurrent requests (k6 smoke).
- **Assigned agent:** Code Builder
- **Depends on:** 2.1
- **Parallel safe:** no

---

### Story 2.3 — Container Control Endpoints (Start / Stop / Restart)

- **Points:** 3
- **Acceptance:**
  - `POST /api/containers/:id/start`, `POST /api/containers/:id/stop`, `POST /api/containers/:id/restart` implemented.
  - Each endpoint validates that the container ID exists before acting; returns HTTP 404 for unknown IDs.
  - Attempting to start an already-running container returns HTTP 409 with an informative message.
  - All three actions are tested with unit tests (mocked Docker client); happy path + error path covered.
  - No action is taken when the Docker socket is unavailable (HTTP 503 returned).
- **Assigned agent:** Code Builder
- **Depends on:** 2.2
- **Parallel safe:** no

---

### Story 2.4 — Stats Endpoint (CPU, Memory, Disk, RAM, Uptime)

- **Points:** 5
- **Acceptance:**
  - `GET /api/stats` returns:
    - Per-container: `cpu_percent`, `mem_usage_mb`, `mem_limit_mb`
    - Server-level: `disk_used_gb`, `disk_total_gb`, `ram_used_mb`, `ram_total_mb`, `uptime_seconds`, `server_time` (ISO 8601)
  - CPU % calculated from Docker stats stream delta (not raw ticks).
  - Server disk stats read from the filesystem mount (no shell exec; use Node.js `fs` / `os` APIs or `systeminformation` library).
  - Unit tests cover percentage calculation logic and edge cases (zero CPU delta, no containers).
  - Response time p99 < 300 ms under 10 concurrent requests.
- **Assigned agent:** Code Builder
- **Depends on:** 2.2
- **Parallel safe:** yes (can develop alongside 2.3)

---

## Epic 3 — Dashboard Frontend

React SPA served as static files through the backend or a dedicated Nginx container behind Traefik.

---

### Story 3.1 — React Project Scaffold & Routing

- **Points:** 2
- **Acceptance:**
  - Vite + React + TypeScript project bootstrapped under `dashboard/frontend/`.
  - ESLint and Prettier configured and passing.
  - Multi-stage Dockerfile: build stage produces static assets; runtime stage serves via Nginx (or `serve`).
  - Nginx/serve Dockerfile passes Trivy image scan (no HIGH/CRITICAL).
  - Placeholder home page renders at `/` without console errors.
- **Assigned agent:** Code Builder
- **Depends on:** 1.1
- **Parallel safe:** yes

---

### Story 3.2 — Container Table with Status Badges & Action Buttons

- **Points:** 5
- **Acceptance:**
  - Table renders columns: Name, Image, Status, CPU %, Memory, Actions.
  - Status badge colour-coded: green = running, grey = stopped, red = errored.
  - Start / Stop / Restart buttons trigger the corresponding `POST /api/containers/:id/*` endpoint.
  - Buttons disabled (with loading spinner) while an action is in-flight; re-enabled on response.
  - An error toast appears if an API call returns non-2xx.
  - Component tests (Vitest + Testing Library) cover: badge colours, disabled state during action, error toast.
- **Assigned agent:** Code Builder
- **Depends on:** 3.1, 2.3
- **Parallel safe:** no

---

### Story 3.3 — Server Stats Panel

- **Points:** 3
- **Acceptance:**
  - Stats panel displays: server time/date, disk used/total, RAM used/total, server uptime (human-readable, e.g. "3d 4h 12m").
  - Data fetched from `GET /api/stats`.
  - Panel and container table both auto-refresh every 15 seconds without full-page reload.
  - Loading skeleton shown on initial fetch; error state shown if stats endpoint is unreachable.
  - Component tests cover: loading state, populated state, error state.
- **Assigned agent:** Code Builder
- **Depends on:** 3.2, 2.4
- **Parallel safe:** no

---

### Story 3.4 — Dashboard Traefik Routing & Static Asset Serving

- **Points:** 2
- **Acceptance:**
  - Frontend container added to `docker-compose.yml` with Traefik labels routing `dashboard.domain.com` → frontend.
  - Backend API proxied at `dashboard.domain.com/api` → backend container (avoids CORS).
  - TLS certificate valid; HTTP redirects to HTTPS.
  - `docker compose up` brings the full dashboard stack up in one command.
  - End-to-end smoke: `curl -k https://dashboard.domain.com/` returns HTTP 200 and non-empty HTML body.
- **Assigned agent:** Infra
- **Depends on:** 3.3, 1.4
- **Parallel safe:** no

---

## Epic 4 — Auth & Security

Protects the dashboard from unauthenticated access via Traefik basic auth middleware.

---

### Story 4.1 — Traefik Basic Auth Middleware

- **Points:** 3
- **Acceptance:**
  - `basicauth` middleware configured in Traefik and attached to the `dashboard.domain.com` router.
  - Credentials stored exclusively as a Gitea Actions secret (`DASHBOARD_HTPASSWD`); the agent does NOT generate or read the plaintext password — human gate `credential_actions` is invoked.
  - Unauthenticated request to `dashboard.domain.com` returns HTTP 401 with `WWW-Authenticate` header.
  - Authenticated request (valid credentials) returns HTTP 200.
  - Middleware configuration passes Trivy IaC scan.
- **Assigned agent:** Infra
- **Depends on:** 3.4
- **Parallel safe:** no

---

### Story 4.2 — Docker Socket Least-Privilege Hardening

- **Points:** 2
- **Acceptance:**
  - Backend container mounts `/var/run/docker.sock` as read-write only where needed; socket mount documented in Compose file with a comment.
  - Container runs as a non-root user (UID >= 1000) in the Dockerfile.
  - Compose file sets `read_only: true` on the container filesystem where feasible; `/tmp` tmpfs mounted separately.
  - Trivy IaC scan passes with no HIGH findings related to socket or privilege escalation.
  - Security rationale documented in a brief ADR under `docs/adr/`.
- **Assigned agent:** Infra
- **Depends on:** 2.1
- **Parallel safe:** yes (can develop alongside Epic 3 stories)

---

## Epic 5 — CI/CD Pipeline

Wires up all five gauntlet stages in Gitea Actions for the dashboard repository.

---

### Story 5.1 — T1: Unit & Integration Tests Stage

- **Points:** 3
- **Acceptance:**
  - Gitea Actions workflow file `.gitea/workflows/ci.yml` created.
  - T1 job: runs `npm test` for backend and `npm test` for frontend; fails workflow on any test failure.
  - Coverage report published as a workflow artifact; pipeline fails if coverage < 80 %.
  - Workflow triggers on push to any branch and on PR open/sync.
  - At least one intentional test failure in a throwaway branch confirms the hard block works.
- **Assigned agent:** CI/CD Builder
- **Depends on:** 2.3, 3.2
- **Parallel safe:** yes

---

### Story 5.2 — T2: SAST via Semgrep

- **Points:** 3
- **Acceptance:**
  - T2 job runs `semgrep --config=auto` against the codebase.
  - Workflow step fails (non-zero exit) if any CRITICAL or HIGH finding is reported.
  - Semgrep results uploaded as SARIF artifact.
  - Job runs in parallel with T1 (or sequentially if runner concurrency is 1); does not gate on T1 completion.
  - Zero CRITICAL/HIGH findings in the current codebase before merging this story.
- **Assigned agent:** CI/CD Builder
- **Depends on:** 5.1
- **Parallel safe:** yes (T2 can run parallel to T1 in the pipeline)

---

### Story 5.3 — T3: IaC & Image Scan via Trivy

- **Points:** 3
- **Acceptance:**
  - T3 job runs `trivy config` against all Compose files and Dockerfiles.
  - T3 also runs `trivy image` against the built dashboard backend and frontend images.
  - Workflow step fails if any HIGH or CRITICAL severity finding is found.
  - Trivy DB updated at the start of each run (not cached stale DB).
  - SARIF output uploaded as artifact.
- **Assigned agent:** CI/CD Builder
- **Depends on:** 5.2
- **Parallel safe:** no (image scan requires built images from prior step)

---

### Story 5.4 — T4: DAST via OWASP ZAP + k6 Performance

- **Points:** 8
- **Acceptance:**
  - T4 job deploys the dashboard stack to the QA slot (using the `qa` Compose profile) before scanning.
  - OWASP ZAP baseline scan run against `https://qa.domain.com`; HIGH/CRITICAL findings fail the workflow.
  - k6 load test run with 20 VUs for 30 seconds; p99 latency threshold of 500 ms; failure = hard block.
  - QA slot torn down after T4 completes (pass or fail).
  - ZAP HTML report and k6 summary uploaded as artifacts.
  - Workflow only runs T4 on PRs targeting `main` (not on every feature branch push).
- **Assigned agent:** CI/CD Builder
- **Depends on:** 5.3, 4.1
- **Parallel safe:** no

---

### Story 5.5 — T5: Policy Gate (Trivy CVE + Gitleaks)

- **Points:** 5
- **Acceptance:**
  - T5 job runs `gitleaks detect` on the full git history; any secret detected = hard block.
  - T5 also runs a final `trivy image` CVE scan on the images tagged for promotion.
  - If all gates pass, the workflow tags the image with the git SHA digest and pushes to the Gitea container registry.
  - Promotion to prod is blocked until the `prod_deployment_approval` human gate is acknowledged by Helmwill.
  - Workflow status badge embedded in the repository README.
- **Assigned agent:** CI/CD Builder
- **Depends on:** 5.4
- **Parallel safe:** no

---

## Epic 6 — Observability

Health checks, smoke tests, and pipeline status visibility ensure the platform is self-monitoring.

---

### Story 6.1 — Container & Service Health Checks

- **Points:** 2
- **Acceptance:**
  - `HEALTHCHECK` instructions added to all Dockerfiles (backend, frontend).
  - Docker Compose `healthcheck` blocks configured for Traefik, Gitea, and dashboard containers.
  - Unhealthy containers surface as `errored` status in the dashboard container list (leverages Story 2.2 logic).
  - `docker compose ps` shows all services as `healthy` after a clean `up -d`.
- **Assigned agent:** Infra
- **Depends on:** 3.4
- **Parallel safe:** yes

---

### Story 6.2 — Smoke Test Suite & Pipeline Status Visibility

- **Points:** 3
- **Acceptance:**
  - A smoke test script (`scripts/smoke.sh` or k6 script) verifies: dashboard returns HTTP 200, `/api/health` returns `{ status: "ok" }`, `/api/containers` returns a non-empty array, `/api/stats` returns valid JSON.
  - Smoke tests run as the final step of the `prod` deployment workflow after Helmwill approves.
  - If any smoke test fails, the deployment is automatically rolled back to the previous image digest.
  - Gitea Actions workflow badge for the `main` branch visible on the repository landing page.
  - Execution log (`docs/execution-log.json`) updated with deployment timestamp and smoke test result.
- **Assigned agent:** CI/CD Builder
- **Depends on:** 5.5, 6.1
- **Parallel safe:** no

---

## Dependency Graph

```
1.1 (Network Scaffold)
 └─ 1.2 (Traefik + SSL)
     └─ 1.3 (Gitea Stack)
         └─ 1.4 (Env Routing)

1.1 ─────────────────────────┐
 └─ 2.1 (Backend Scaffold)   │
     └─ 2.2 (Container List) │
         ├─ 2.3 (Controls)   │
         └─ 2.4 (Stats)      │
                              │
1.1 ─────────────────┐        │
 └─ 3.1 (FE Scaffold)│        │
     └─ 3.2 (Table)  │        │
         └─ 3.3 (Stats Panel) │
             └─ 3.4 (Traefik Route) ←─ 1.4
                 └─ 4.1 (Basic Auth)
                     └─ 5.4 (T4 DAST)

2.1 ─────────────────────────┘
 └─ 4.2 (Socket Hardening)

2.3 ──┐
3.2 ──┴─ 5.1 (T1 Tests)
         └─ 5.2 (T2 SAST)
             └─ 5.3 (T3 IaC)
                 └─ 5.4 (T4 DAST) ←─ 4.1
                     └─ 5.5 (T5 Policy Gate)

3.4 ─┐
6.1 (Health Checks) ─┐
                      └─ 6.2 (Smoke Tests + Visibility) ←─ 5.5
```

**Critical path (longest blocking chain):**
1.1 → 1.2 → 1.3 → 1.4 → 3.4 → 4.1 → 5.4 → 5.5 → 6.2

---

## Sprint Breakdown

> 2 weeks per sprint. Default concurrency: 2 stories in parallel.
> Stories marked **Parallel safe: yes** may run concurrently within the same sprint.
> Human gate `planning_pr_approval` required before Sprint 1 begins.

| Sprint | Stories | Focus | Points |
|--------|---------|-------|--------|
| 1 | 1.1, 1.2 | Network scaffold + Traefik/SSL | 3 + 5 = **8** |
| 2 | 1.3, 1.4 | Gitea stack + environment routing | 5 + 3 = **8** |
| 3 | 2.1, 3.1 | Backend scaffold + Frontend scaffold (parallel) | 3 + 2 = **5** |
| 4 | 2.2, 4.2 | Container list endpoint + socket hardening (parallel) | 3 + 2 = **5** |
| 5 | 2.3, 2.4 | Container controls + stats endpoint (parallel) | 3 + 5 = **8** |
| 6 | 3.2, 3.3 | Container table UI + stats panel | 5 + 3 = **8** |
| 7 | 3.4, 6.1 | Traefik routing + health checks (parallel) | 2 + 2 = **4** |
| 8 | 4.1, 5.1 | Basic auth + T1 test pipeline (parallel) | 3 + 3 = **6** |
| 9 | 5.2, 5.3 | T2 SAST + T3 IaC scan (sequential in pipeline) | 3 + 3 = **6** |
| 10 | 5.4 | T4 DAST + k6 performance (complex; solo sprint) | **8** |
| 11 | 5.5, 6.2 | T5 policy gate + smoke tests/visibility | 5 + 3 = **8** |

**Total sprints:** 11 (22 weeks)

### Sprint Notes

- **Sprint 3** is the first sprint where two epics run fully in parallel (backend and frontend scaffolds have no inter-dependency).
- **Sprint 5** runs Stories 2.3 and 2.4 in parallel; Story 2.4 (stats) only requires the Docker socket client from 2.1, not 2.3.
- **Sprint 7** — Story 3.4 (Traefik routing) depends on 3.3 completing in Sprint 6, and on 1.4 completing in Sprint 2. It is therefore unblocked by end of Sprint 6. Story 6.1 (health checks) depends on 3.4, so it follows 3.4 within the sprint.
- **Sprint 10** is a solo sprint for Story 5.4 due to its complexity (8 points) and the integration work of spinning up a live QA environment for DAST.
- **Sprint 11** contains the final pipeline gate and smoke test suite; Helmwill's `prod_deployment_approval` gate is the last manual step before prod traffic is live.

---

## Total Story Points

| Epic | Stories | Points |
|------|---------|--------|
| 1 — Foundation | 1.1, 1.2, 1.3, 1.4 | 3 + 5 + 5 + 3 = **16** |
| 2 — Dashboard Backend | 2.1, 2.2, 2.3, 2.4 | 3 + 3 + 3 + 5 = **14** |
| 3 — Dashboard Frontend | 3.1, 3.2, 3.3, 3.4 | 2 + 5 + 3 + 2 = **12** |
| 4 — Auth & Security | 4.1, 4.2 | 3 + 2 = **5** |
| 5 — CI/CD Pipeline | 5.1, 5.2, 5.3, 5.4, 5.5 | 3 + 3 + 3 + 8 + 5 = **22** |
| 6 — Observability | 6.1, 6.2 | 2 + 3 = **5** |
| **Grand Total** | **17 stories** | **74 points** |

---

*This plan was generated by the Sprint Planner agent on 2026-03-12 and is subject to Helmwill's approval via human gate `planning_pr_approval` before execution begins.*
