# ADR-003: Dashboard Architecture — Node.js Backend + React Frontend with Docker Socket Access

## Status: Accepted

## Context

The platform requires a custom web UI that serves as its operational centrepiece. The dashboard must:

- Display real-time status, CPU usage, and memory usage for every container on the host.
- Provide start, stop, and restart controls per container.
- Show host-level metrics: uptime, remaining disk space, remaining RAM, and current server time.
- Be served via Traefik over HTTPS on a subdomain (e.g., `dashboard.domain.com`).
- Be protected by authentication to prevent unauthorised container control.
- Query the Docker daemon directly to obtain container and host metrics without deploying a separate metrics stack (e.g., Prometheus + Grafana) — which would add operational overhead and memory footprint for a v1 tool.

The implementation must fit within the TypeScript-everywhere mandate from ADR-001 and must not introduce new languages or runtimes beyond Node.js 20 LTS and React.

Key risk: accessing the Docker socket from within a container is equivalent to root access on the host. This risk must be bounded by design.

Alternatives evaluated for the backend/metrics approach:

- **Prometheus + Grafana + cAdvisor** — Production-grade observability stack; however, it comprises three additional services, requires persistent storage for Prometheus TSDB, and is disproportionately complex for a dashboard that only needs current-state snapshots, not historical time-series. Grafana also cannot provide container control actions.
- **Portainer** — An existing OSS Docker management UI. Would satisfy most requirements immediately, but: (a) it is a third-party product the team cannot modify, (b) it does not integrate with the platform's Traefik label routing pattern, and (c) the brief explicitly specifies a custom dashboard as the centrepiece of the project.
- **Go + templ (server-rendered)** — Lighter binary footprint; however, Go introduces a second language and the Docker SDK for Go offers no material advantage over the Node.js SDK for this use case.
- **Python + FastAPI + HTMX** — Viable, but TypeScript is the team's primary language and sharing type definitions between front and back end is a concrete benefit.

Alternatives evaluated for authentication:

- **OAuth2 / OIDC (e.g., Authelia, Authentik)** — Full SSO with MFA capability. Adds one or two more containers and a persistent database; excessive for a single-approver internal tool.
- **Traefik ForwardAuth middleware** — Could delegate auth to a sidecar. Adds complexity and a new service boundary. Basic auth handled natively by Traefik middleware is simpler and auditable.
- **JWT / session-based login page** — A custom login page with session tokens is more user-friendly than browser-native basic auth prompts, and avoids sending base64-encoded credentials on every request. This is the preferred direction for v1 (simple login form posting to `/api/auth/login`, returning a short-lived signed session cookie).

## Decision

The dashboard is implemented as a two-process application in a single Docker container:

- **Backend:** Node.js 20 LTS, TypeScript. Exposes a REST API (documented in `docs/architecture.md` §7.1). Communicates with the Docker daemon via the Unix socket at `/var/run/docker.sock` using the `dockerode` library (the de-facto Node.js Docker SDK).
- **Frontend:** React (TypeScript), compiled to a static asset bundle served by the Node.js backend at `/`. The React SPA polls the backend REST endpoints for live container and system metrics.

**Docker socket access is scoped and bounded as follows:**

1. The socket is mounted into the dashboard backend container only: `/var/run/docker.sock:/var/run/docker.sock`.
2. The backend process runs as a non-root user inside the container. The container image's `USER` instruction sets a non-root UID. The socket mount's Unix group (`docker`) is mapped so the non-root user has read+write access.
3. The backend container is granted no additional Linux capabilities beyond the default Docker set. `privileged: false` is explicit in the Compose definition.
4. The container control endpoints (start, stop, restart) are gated behind authentication. Unauthenticated requests return HTTP 401 before any Docker API call is made.
5. The backend exposes no raw Docker API passthrough. Only the specific operations listed in the API contract are implemented; there is no generic proxy to the socket.

**Authentication:** A simple login page (username + password) issues a signed HTTP-only session cookie (short TTL). The bcrypt-hashed password is injected at runtime from the Gitea Actions secret store. There is no plaintext credential in any image layer, Compose file, or source file.

**Serving:** The Node.js process serves both the React SPA (static files) and the `/api/*` endpoints on a single port. Traefik routes `dashboard.domain.com` to this port on the internal Docker network. TLS termination occurs at Traefik; the backend listens on plain HTTP internally.

## Consequences

**Positive:**

- Single container for both frontend and backend simplifies deployment, reduces inter-service network calls, and avoids a separate static file server (Nginx/Caddy).
- TypeScript on both sides enables shared type definitions for API response shapes, reducing integration bugs.
- Direct Docker socket access gives real-time, low-latency container metrics without polling an intermediary metrics store.
- The REST API is thin and purpose-built; the attack surface is limited to the six documented endpoints.
- Basic auth / session cookie is trivially understandable and auditable — no OAuth flows, no token refresh complexity.

**Negative / Trade-offs:**

- Docker socket access is inherently high-privilege. Any Remote Code Execution vulnerability in the Node.js process would give an attacker container control. Mitigations: non-root user, no privileged flag, SAST (T2) and DAST (T4) gauntlet gates, and no raw socket proxy.
- The React SPA polls the backend on a timer (suggested interval: 5 seconds). This is simpler than WebSockets but slightly increases latency to observe state changes. WebSocket upgrade can be added in a later iteration.
- There is no role-based access control. Any authenticated user can start and stop any container. Acceptable for a single-approver platform; would need RBAC before a multi-team deployment.
- Session state is in-memory by default. A container restart logs all users out. A Redis session store can be added in a later iteration if needed.
- The frontend is a compiled artifact. A CI step must build the React bundle before the Docker image is built. The Dockerfile must perform a multi-stage build: `node:20-alpine` builder stage for `npm run build`, then a minimal runtime stage.
