# ADR-005: Gitea + Gitea Actions as SCM and CI/CD Platform

## Status: Accepted

## Context

The platform requires a self-hosted Git service and a CI/CD system that can:

- Host all source repositories with access control, code review (pull requests), and webhook events.
- Trigger pipeline runs on push, PR open, and PR merge events without polling.
- Build Docker images inside pipeline jobs.
- Push built images to a container registry accessible by the Compose deploy steps.
- Run the five-stage security gauntlet (T1–T5) per ADR-001.
- Store secrets (registry credentials, TLS email, auth password hash) securely, injected at pipeline runtime.
- Enforce the manual approval gate before production deployments (Helmwill as approver).
- Operate entirely on the VPS — no outbound runner registration with a cloud service.
- Require no licence cost.

The CI/CD system must support the three-environment model: dev (redeploy on push), QA (ephemeral on PR open, torn down on merge), and prod (persistent, manual gate).

Alternatives evaluated:

- **GitLab CE (self-hosted)** — Full-featured SCM + CI/CD + registry + package registry in one product. However: (a) minimum memory requirement is ~4 GB RAM; on a budget VPS this may leave insufficient headroom for all other platform services; (b) GitLab's YAML CI syntax is different from GitHub Actions, which the team is more familiar with; (c) the built-in container registry is a separate service (GitLab Container Registry daemon) adding more complexity.
- **GitHub + GitHub Actions (hosted)** — Eliminates the need to host SCM, but: (a) violates the zero-cloud constraint — code leaves the VPS and runners are GitHub-hosted; (b) the free tier imposes job-minute limits; (c) secrets are managed externally on GitHub, not on the VPS.
- **Forgejo + Forgejo Actions** — A hard fork of Gitea with an independent release cadence. API-compatible with Gitea. An equally valid choice; however, Gitea is the upstream and has wider community tooling and documentation at the time of this decision (2026-03-12). The switch to Forgejo is low-cost if required in future.
- **Drone CI + Gitea** — Drone CI pairs well with Gitea via webhook. However, it introduces a second product to maintain (Drone server + runner), a second set of YAML syntax to learn, and a second secret store. Gitea Actions consolidates these concerns into the SCM product itself.
- **Jenkins + Gitea** — Jenkins has the widest plugin ecosystem but carries: JVM memory overhead (~512 MB baseline), a plugin update treadmill, and a Groovy/Jenkinsfile DSL unfamiliar to the team. The operational burden is disproportionate for this platform's scope.
- **Woodpecker CI + Gitea** — OSS, lightweight, GitHub Actions-compatible syntax. A strong alternative to Gitea Actions; however, it still requires a separate server process and its own secret store, whereas Gitea Actions is natively integrated.

## Decision

Gitea (latest stable) is adopted as the sole SCM platform. Gitea Actions (built-in, GitHub Actions YAML-compatible) is adopted as the CI/CD engine. The Gitea built-in OCI container registry (packages feature) is adopted as the image registry.

**Architecture:**

- Gitea runs as a single Docker container with a persistent volume for repositories, database (SQLite for simplicity at this scale), and the built-in registry blobs.
- A Gitea Actions runner runs as a separate Docker container on the same host. The runner is registered to the Gitea instance via a registration token (stored as a Gitea Actions secret). The runner executes jobs inside Docker containers (Docker-in-Docker or a Docker socket mount, scoped to the runner only).
- Workflow files (`.gitea/workflows/*.yml`) are committed to each repository and follow GitHub Actions YAML syntax. Existing GitHub Actions community actions (e.g., `actions/checkout`, `actions/setup-node`) are compatible with Gitea Actions where the action does not call the GitHub API.

**Environment pipeline logic:**

| Event | Workflow triggered | Environment | Lifecycle |
|---|---|---|---|
| Push to feature branch | `dev.yml` | dev | Deploy; tear down on branch delete |
| PR opened against main | `qa.yml` | qa | Deploy; tear down on PR merge |
| Merge to main | `prod.yml` | prod | Deploy after manual approval gate |

**Manual approval gate (Helmwill):** The production workflow uses a Gitea Actions environment with a required reviewer. The job that performs `docker compose up` in prod is gated on Helmwill's approval in the Gitea UI. The pipeline halts at the gate until approval is granted or the run times out (configurable, default 7 days).

**Security gauntlet enforcement:** Each workflow file defines five jobs (T1–T5) with `needs` dependencies ensuring sequential execution. A `fail-fast: true` strategy means that any hard-block failure terminates the run immediately. Findings that trigger a hard block cannot be suppressed by workflow edits without a PR (which requires Helmwill's review). Suppression attempts are treated as a security violation.

**Secret management:** All secrets (registry password, TLS cert email, dashboard auth hash) are stored in Gitea's Actions secret store (per-organisation or per-repository, encrypted at rest). Secrets are referenced in workflow YAML as `${{ secrets.SECRET_NAME }}` and are never printed to logs (Gitea Actions masks secret values in log output automatically).

**Container builds:** The `docker build` and `docker push` steps in the pipeline use the Gitea registry URL (`gitea.domain/owner/image:sha`). The image is tagged with the full Git commit SHA and an additional `sha-<short>` alias. The prod deploy step references the full digest (`@sha256:...`) to guarantee the exact same image is promoted, not just the same tag.

**Agent rules enforcement:**

- No agent or pipeline step pushes directly to `main`. All changes arrive via PR.
- Three consecutive gauntlet failures on the same story trigger `NEEDS_HUMAN` state, recorded in `docs/execution-log.json`.
- Pipeline concurrency is limited: `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` to prevent duplicate deploys on rapid pushes.

## Consequences

**Positive:**

- Gitea unifies SCM, CI/CD trigger events, secret store, and OCI registry in a single service. Fewer services to maintain, monitor, and back up.
- GitHub Actions YAML compatibility means existing knowledge, documentation, and many community actions transfer directly.
- The manual approval gate for prod is a first-class Gitea Actions feature (environments with required reviewers), not a workaround.
- SQLite as the Gitea database eliminates the need for a separate database container at this scale. The database file is trivially backed up by copying a single file.
- The Gitea built-in registry stores images alongside code, simplifying access control — the same Gitea user and token that can push code can also push images.

**Negative / Trade-offs:**

- Gitea Actions is newer and less battle-tested than GitHub Actions or Jenkins. Some GitHub Actions community actions call GitHub-specific APIs and will fail when run on Gitea Actions. These must be replaced with equivalent direct shell commands or Gitea-compatible actions.
- SQLite limits Gitea to single-writer access. Under high concurrent CI load (many simultaneous push events), SQLite write locking may become a bottleneck. Mitigated by the `concurrency_max: 5` agent rule. Can be migrated to PostgreSQL if needed.
- The Gitea Actions runner executes builds using Docker on the host. If a malicious or misconfigured workflow mounts the host filesystem or Docker socket in a build container, it could escape the runner sandbox. Mitigated by: (a) runner container running with a non-root user; (b) Gitleaks T5 gate scanning workflow files for credential leaks; (c) PRs to workflow files requiring Helmwill approval.
- There is no built-in notification mechanism (Slack, email) configured in scope (notifications channel is null per the project brief). Pipeline failures are visible in the Gitea web UI only. A future iteration can add webhook notifications.
- Gitea's built-in OCI registry does not support image retention/garbage collection policies via UI. Old image blobs accumulate on disk. A periodic cleanup script or manual `gitea admin` command is needed to reclaim disk space over time.
