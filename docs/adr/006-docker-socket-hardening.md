# ADR-006 — Docker Socket Least-Privilege Hardening

**Date:** 2026-03-12
**Status:** Accepted
**Story:** 4.2

---

## Context

The dashboard backend must query the Docker daemon to list containers and read their stats. This requires access to `/var/run/docker.sock`. Unrestricted access to the Docker socket is equivalent to root on the host — a compromised container with read-write socket access can spawn privileged containers, mount host filesystems, and escape the container boundary.

---

## Decision

Apply three layers of hardening to the backend container across all environments (dev, qa, prod):

### 1. Read-only Docker socket mount

The socket is mounted `:ro` (read-only) in all Compose files:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

The dashboard only reads container state — it never needs to create, start, or stop containers via the socket at this stage. Read-only mount prevents any write operations to the daemon.

### 2. Non-root user in Dockerfile

The backend runtime stage runs as the built-in `node` user (UID 1000):

```dockerfile
USER node
```

If an attacker exploits the application, they land as UID 1000, not root, limiting lateral movement.

### 3. Read-only container filesystem + `/tmp` tmpfs

All Compose files set:

```yaml
read_only: true
tmpfs:
  - /tmp
security_opt:
  - no-new-privileges:true
```

- `read_only: true` prevents the container from writing anywhere on the root filesystem, limiting the blast radius of a compromise.
- `/tmp` as tmpfs provides a writable scratch space for the Node.js runtime without persisting anything to disk.
- `no-new-privileges` prevents privilege escalation via setuid binaries.

---

## Consequences

- **Positive:** Significantly reduces the attack surface if the dashboard API is compromised.
- **Positive:** Trivy IaC scan passes with no HIGH/CRITICAL findings related to socket or privilege escalation.
- **Trade-off:** If a future feature requires write access to the Docker socket (e.g. container start/stop), the socket mount must be changed from `:ro` to `:rw` and the change reviewed as a security decision.
- **Trade-off:** `read_only: true` may break libraries that write to the filesystem at runtime. Any such library must be configured to write to `/tmp` instead.
