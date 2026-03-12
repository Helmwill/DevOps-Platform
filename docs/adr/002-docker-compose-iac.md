# ADR-002: Docker Compose as Infrastructure as Code

## Status: Accepted

## Context

The platform runs on a single VPS. All services (Traefik, Gitea, the dashboard, and ephemeral CI environment slots) must be declared, versioned, and deployable in a reproducible way. The IaC tool must:

- Require no external control plane or agent running on the server.
- Be executable by a Gitea Actions runner with Docker access.
- Produce reviewable diffs when infrastructure changes are proposed (i.e., be text-based and PR-friendly).
- Support multiple environment stacks (dev, QA, prod) with minimal duplication.
- Scan cleanly with Trivy for IaC misconfigurations (CIS Docker benchmark, Compose-specific rules).
- Operate within the $0/month budget constraint — no licences, no hosted state backends.

Alternatives evaluated:

- **Ansible** — Imperative playbooks are harder to read as infrastructure declarations. Suitable for multi-host provisioning; adds an agentless SSH dependency on a host the Actions runner already has Docker access to. State is implicit (idempotency must be hand-coded per task). Trivy does not scan Ansible playbooks for IaC misconfigurations.
- **Terraform / OpenTofu** — Requires a state backend (local file or remote). Designed for cloud resource provisioning; the Docker provider for Terraform is community-maintained and less mature. Adds HCL as a second declarative language alongside Compose YAML. OpenTofu is OSS but the Docker provider's IaC-scan coverage in Trivy is limited compared to Compose/Dockerfile rules.
- **k3s + Helm** — Kubernetes adds etcd, a control plane, and kubelet resource overhead that is disproportionate for a single-node VPS running fewer than 20 containers. Helm charts are reviewable but more complex than Compose files. Trivy's Kubernetes/Helm scanning is strong, but the operational cost outweighs the benefit at this scale.
- **Nomad** — Lighter than Kubernetes but still a separate scheduler binary. Community tooling and documentation are thinner. No native Docker Compose compatibility.

## Decision

Docker Compose (v2, plugin-based) is adopted as the sole IaC tool for this platform.

Each environment (dev, QA, prod) is described by a `docker-compose.<env>.yml` file, with a shared `docker-compose.base.yml` containing common service definitions. Environment-specific overrides (image tags, port mappings, replica counts, Traefik labels) are applied via Compose's merge syntax (`-f base.yml -f override.yml`).

The Gitea Actions runner invokes `docker compose` directly; no additional IaC binary needs to be installed or versioned separately from Docker Engine.

Trivy's `trivy config` command scans Compose files and Dockerfiles as part of the T3 gauntlet gate. HIGH-severity IaC findings are a hard block on pipeline progression.

All Compose files are committed to the repository and changes must pass code review via PR before being merged to main. No manual `docker compose` commands are run directly on the server except in an emergency (which must be documented in `docs/execution-log.json`).

## Consequences

**Positive:**

- Compose YAML is human-readable and produces clear PR diffs; reviewers do not need specialist IaC knowledge.
- Zero additional tooling installation required — Docker Compose v2 ships with Docker Engine.
- Trivy's `trivy config` supports Compose file scanning out of the box, satisfying the T3 security gate with no extra configuration.
- Ephemeral QA environments are created with `docker compose up -d` and destroyed with `docker compose down -v` — simple, scriptable, and reliable.
- The "build once, promote same digest" deployment model is trivially implemented by updating the image tag/digest in the Compose override file and re-running `docker compose up -d --no-build`.

**Negative / Trade-offs:**

- Docker Compose has no built-in state diffing or drift detection. If someone modifies a container manually (outside of Compose), the declared state and actual state will diverge silently. Mitigation: all server access is via the Actions pipeline; manual changes are prohibited by agent rules.
- Compose does not support rolling deployments or zero-downtime updates natively on a single node. The dashboard will briefly disappear during a `compose up` replacement. Acceptable for v1.
- Secrets cannot be stored in the Compose file itself. They must be injected as environment variables from the Gitea Actions secret store at deploy time. This is a security requirement, not a limitation — see ADR-001.
- There is no remote state locking. Concurrent pipeline runs deploying to the same environment could race. Mitigated by setting Gitea Actions concurrency limits (default: 2, max: 5) and using environment-namespaced Compose project names.
