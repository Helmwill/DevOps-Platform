# ADR-004: Traefik as Edge Router and TLS Terminator

## Status: Accepted

## Context

All platform services (the dashboard, Traefik itself, and ephemeral QA slots) must be reachable over HTTPS via human-readable subdomains. The edge router must:

- Terminate TLS for all subdomains using certificates that are automatically provisioned and renewed — no manual `certbot` cronjobs.
- Discover new services dynamically when Docker Compose stacks are deployed, without requiring a reload of the router's configuration.
- Support per-route middleware (authentication, redirect, headers) declared as code.
- Run as a Docker container, managed by Compose alongside all other platform services.
- Be free and OSS, with no licence cost.
- Operate on a single VPS with a single public IP address.

Routing must support at minimum:

| Subdomain | Service |
|---|---|
| `dashboard.domain` | Dashboard backend (Node.js) |
| `qa-<pr-number>.domain` | Ephemeral QA environment per PR |

The platform has no load-balancing requirement (single backend instance per route) and no requirement for HTTP/2 push or gRPC at v1.

Alternatives evaluated:

- **Nginx Proxy Manager (NPM)** — Web-GUI-driven configuration. Routes are stored in a SQLite database, not in version-controlled files. Changes to routing cannot be code-reviewed via PRs. Automatic TLS relies on the same ACME mechanism as Traefik, but the configuration is not Infrastructure as Code. Rejected because it violates the "all infrastructure in code" principle.
- **Caddy** — Excellent automatic TLS and a clean Caddyfile syntax. However, Caddy's Docker integration requires either a Caddyfile reload on each service change or a third-party Docker plugin (`caddy-docker-proxy`). Traefik's Docker provider is first-class and natively watches the Docker event stream. Caddy would be a strong alternative if Docker-native label routing were not a requirement.
- **Nginx (plain)** — High performance and well-understood. However: (a) certificate management requires a separate Certbot container and cronjob, (b) adding a new service requires editing `nginx.conf` and reloading, (c) there is no native Docker container discovery. Viable but significantly more operational overhead.
- **HAProxy** — Excellent for high-throughput TCP and HTTP load balancing. Requires manual certificate management (no native ACME). Configuration is not Docker-label-driven. Better suited to a multi-server deployment.
- **Envoy / Istio** — Service-mesh-grade proxying. Adds substantial complexity and resource consumption. Designed for multi-service microservice meshes, not a single-node personal platform.

## Decision

Traefik v3 is adopted as the sole edge router and TLS terminator for the platform.

**Configuration approach:**

- **Static configuration** (entrypoints, ACME resolver, Docker provider) is declared in `traefik.yml`, committed to the repository, and mounted into the Traefik container at startup.
- **Dynamic configuration** is entirely label-driven. Each Compose service that requires public routing declares Traefik labels in its Compose definition. Traefik watches the Docker event stream and picks up new routes without a restart.
- **TLS** is handled by the built-in Let's Encrypt ACME resolver (`letsencrypt` named resolver). Certificates are stored in an `acme.json` volume mount. The TLS challenge method is HTTP-01 (port 80 must be reachable from the internet during initial issuance). Certificates auto-renew 30 days before expiry.
- **HTTP to HTTPS redirect** is implemented as a global Traefik entrypoint redirect: all traffic arriving on `:80` is redirected to `:443`.
- **Middleware** for basic auth (dashboard) and any future security headers (HSTS, CSP) is declared as Traefik middleware labels on the relevant service.
- **VPS SSH** for deploy operations is accessed directly on the VPS host port (not routed through Traefik). Git operations use GitHub over HTTPS.

**Ephemeral QA routes:** When the CI pipeline deploys a QA stack for PR `#42`, the Compose override file for that stack sets `traefik.http.routers.qa-42.rule=Host("qa-42.domain")`. Traefik discovers this route automatically. When the QA stack is torn down, Traefik removes the route automatically.

## Consequences

**Positive:**

- Zero manual certificate management. Let's Encrypt certificates are provisioned on first startup and renewed automatically; no cronjobs, no Certbot containers, no manual renewal reminders.
- Docker label routing means adding a new service to the platform requires only adding labels to its Compose definition — no changes to Traefik configuration files. This is fully PR-reviewable.
- Traefik's dashboard (disabled in prod, enabled on a locked-down internal port in dev) provides a live view of all routes, middlewares, and TLS certificates during development.
- Ephemeral QA environment routing is automatic; the pipeline does not need to call any Traefik API to register or deregister routes.
- Traefik v3 supports HTTP/3 (QUIC) and gRPC if needed in future iterations, with no architectural change.
- Traefik is a CNCF project with an active upstream, well-maintained Docker image, and extensive documentation.

**Negative / Trade-offs:**

- Traefik's label-based configuration, while powerful, can become verbose. Long label chains on complex services are harder to read than a dedicated `nginx.conf` block. Mitigated by consistent naming conventions and comments in Compose files.
- The `acme.json` file (certificate store) must be backed up and must not be committed to the repository. It contains private keys. The file is stored in a named Docker volume. Loss of this file requires re-issuance, which may hit Let's Encrypt rate limits (5 certificates per domain per week).
- HTTP-01 ACME challenge requires port 80 to be open to the internet during initial certificate issuance. If the VPS is behind a firewall that blocks port 80, TLS-ALPN-01 or DNS-01 challenge must be used instead. DNS-01 requires a supported DNS provider API key (adding a secret and a provider dependency).
- Traefik's Docker provider grants Traefik access to the Docker socket (read-only for label discovery). This has the same privilege concerns as the dashboard socket access, but Traefik requires only read access and is a well-audited upstream image. The socket mount for Traefik should be `:ro`.
- Routing rules are evaluated in order of priority (router priority). Misconfigured label priorities on overlapping rules can cause unexpected routing. Careful naming conventions and integration tests in the CI pipeline mitigate this.
