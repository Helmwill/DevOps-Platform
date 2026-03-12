# ADR-005: GitHub + GitHub Actions as SCM and CI/CD Platform

## Status: Accepted (supersedes draft Gitea decision)

## Context

The platform is developed inside a GitHub Codespace, meaning the source repository
is already hosted on GitHub and the development toolchain is GitHub-native.
Running a self-hosted Gitea instance alongside GitHub would create two separate
SCM systems with duplicated access control, secret stores, and webhook plumbing —
adding operational overhead without benefit.

The platform requires:

- Source hosting with access control, code review (pull requests), and webhook events.
- Pipeline runs on push, PR open/sync, and PR merge without polling.
- Docker image builds and pushes to an OCI-compatible registry.
- The five-stage security gauntlet (T1–T5) per ADR-001.
- Secrets stored securely, injected at pipeline runtime — never in code.
- Manual approval gate before production deployments (Helmwill as approver).
- No additional licence cost.

## Decision

**GitHub** is adopted as the sole SCM platform. **GitHub Actions** (native) is
adopted as the CI/CD engine. The container registry is configurable via the
`REGISTRY_URL` secret — this may be GitHub Container Registry (`ghcr.io`) or any
other OCI-compatible registry the operator chooses.

**Architecture:**

- All source code lives in the GitHub repository already in use for this project.
- Workflow files (`.github/workflows/*.yml`) follow standard GitHub Actions YAML.
- All community actions (`actions/checkout`, `actions/setup-node`, etc.) work
  natively without compatibility shims.
- Secrets are managed in GitHub repository/environment settings, encrypted at rest,
  and masked in log output automatically.
- The `production` GitHub environment is configured with Helmwill as a required
  reviewer, providing the manual approval gate before prod deployment.

**Environment pipeline logic:**

| Event | Workflow triggered | Environment | Lifecycle |
|---|---|---|---|
| Push to `develop` | `deploy-dev.yml` | dev | Deploy; active until next push |
| After deploy-dev succeeds | `deploy-qa.yml` | qa | Ephemeral; torn down after prod |
| After deploy-qa succeeds | `deploy-prod.yml` | prod | Persistent; manual approval gate |

**Manual approval gate (Helmwill):** The `deploy-prod.yml` workflow targets the
`production` GitHub environment. GitHub halts the job at the `approval-gate` step
until a required reviewer (Helmwill) approves in the GitHub Actions UI. The run
times out after the environment-configured wait time if not approved.

**Secret management:** All secrets (registry password, TLS email, dashboard auth
hash, SSH deploy key, VPS credentials) are stored in GitHub repository/environment
secrets. Referenced in workflow YAML as `${{ secrets.SECRET_NAME }}`. Agents never
handle, request, store, or transmit these values — credential operations are human gates.

**Container builds:** The `docker build` and `docker push` steps use
`${{ secrets.REGISTRY_URL }}` so the registry is operator-configurable. Images are
tagged with `${{ github.sha }}` (full commit SHA) for complete traceability. The prod
deploy step promotes the exact same digest that cleared all QA gates — no rebuild.

**Infra stack change:** The `infra/gitea/` Docker Compose stack has been removed.
Gitea is not needed because GitHub provides SCM, CI/CD, and registry services.
VPS resources previously allocated to the Gitea container are reclaimed.

## Consequences

**Positive:**

- Zero additional infrastructure to run. No Gitea container, no act_runner, no
  separate registry daemon, no PostgreSQL/SQLite for Gitea data.
- Native GitHub Actions support: all community actions work without compatibility
  wrappers. Marketplace actions, OIDC federation, and GitHub-hosted runners are
  all available.
- Secrets, environment protection rules, and required reviewers are managed in
  the same UI developers already use.
- Codespace development workflow is frictionless — commits pushed from the
  Codespace trigger pipelines immediately.

**Negative / Trade-offs:**

- GitHub-hosted runners execute outside the VPS. Build jobs consume GitHub
  Actions free-tier minutes (2 000 min/month for free accounts). Monitor usage
  if the project scales.
- The container registry must be explicitly chosen. `ghcr.io` (GitHub Container
  Registry) is the natural default and integrates with GitHub packages/permissions.
  Alternatively a self-hosted registry on the VPS can be used — set `REGISTRY_URL`
  accordingly.
- The self-hosted VPS is still required for running the deployed application
  (Traefik, dashboard, etc.); only the CI/CD runner moves to GitHub-hosted.
- No built-in on-VPS secret rotation tooling. Operators must rotate secrets
  manually in GitHub Settings.

## Migration note

The previous draft of this ADR selected Gitea. The `.gitea/workflows/` directory
and `infra/gitea/docker-compose.yml` have been removed. All workflow context
variables have been updated from `gitea.*` to `github.*` and `GITEA_OUTPUT` to
`GITHUB_OUTPUT`. Story 1.3 in the sprint plan is updated accordingly.
