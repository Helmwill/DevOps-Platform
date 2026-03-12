# ADR-001: Full Tech Stack Selection

## Status: Accepted

## Context

The VPS Self-Hosted DevOps Platform must operate entirely on a single VPS with zero recurring cloud spend. The platform needs to cover: source control, CI/CD automation, container image registry, TLS-terminated ingress, a custom operations dashboard, and a multi-stage security scanning pipeline.

Constraints that shaped every choice:

- **No cloud services** — all components must run on-VPS as containers.
- **$0/month budget** — only OSS tooling with no hosted tiers or paid licences.
- **Single-node host** — no distributed orchestration; simplicity of operations is paramount.
- **Single approver (Helmwill)** — the platform must be maintainable by a small team without specialist platform engineering knowledge.
- **Security gauntlet** — SAST, CVE scanning, IaC scanning, DAST, and credential detection must all run in the CI pipeline without external SaaS.

The primary language chosen for the dashboard is TypeScript (Node.js 20 LTS backend, React frontend), because TypeScript's static typing reduces runtime defects and the language is used on both sides of the stack, reducing context-switching.

## Decision

The following stack is adopted in full:

| Concern | Technology |
|---|---|
| Source control | GitHub |
| CI/CD | GitHub Actions |
| Container registry | GitHub Container Registry (ghcr.io) or operator-configured OCI registry |
| Reverse proxy + TLS | Traefik v3 + Let's Encrypt |
| IaC | Docker Compose |
| Dashboard backend | Node.js 20 LTS, TypeScript |
| Dashboard frontend | React, TypeScript |
| SAST | Semgrep |
| CVE + IaC scan | Trivy |
| DAST | OWASP ZAP |
| Credential detection | Gitleaks |
| Performance testing | k6 |
| Secret store | GitHub Actions repository/environment secrets |

All components are deployed as Docker containers managed by Docker Compose and exposed through Traefik. No component requires a licence, a SaaS account, or outbound cloud API access to function.

## Consequences

**Positive:**

- Zero cloud cost and zero external service dependencies; the platform is fully air-gap capable.
- GitHub unifies SCM, CI/CD, and OCI registry (ghcr.io) without running any additional self-hosted services.
- GitHub Actions provides the full community marketplace with native support for all standard actions — no compatibility shims required.
- TypeScript across front and back end allows shared type definitions and reduces the total number of languages a maintainer must know.
- All security tooling (Semgrep, Trivy, ZAP, Gitleaks) runs as stateless CLI invocations inside the Actions runner — no persistent security-tool servers to maintain.
- Docker Compose files are plain YAML, easily reviewed in PRs, and directly executable without a cluster.
- Development in GitHub Codespaces is frictionless — pushes from the Codespace trigger pipelines immediately.

**Negative / Trade-offs:**

- Single-node VPS deployment means no automatic failover. A VPS reboot or hardware failure takes the deployed application offline.
- GitHub-hosted runners consume Actions free-tier minutes (2 000 min/month for free accounts). Monitor usage if the project scales.
- Basic auth on the dashboard is simple but not MFA-capable; this is acceptable for a low-exposure internal tool but would need upgrading for a larger team.
- Node.js 20 LTS with Docker socket access requires careful container configuration to avoid privilege escalation risks (addressed in ADR-003).
- Secrets are managed on GitHub, not on the VPS itself. Operators must rotate secrets manually in GitHub Settings.
