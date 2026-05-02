# Repository Structure

Locoris is intentionally split into two repositories:

## Public repository: `locoris`

- `apps/app` — the end-user client
- `apps/personal-server` — free self-hosted sync runtime
- `packages/sync-core` — shared sync helpers used by public runtimes

This repository is safe to open-source after normal review because it excludes runtime server data, managed cloud internals, and production secrets.

## Private repository: `locoris-cloud`

- `apps/api` — managed cloud sync API
- `apps/admin-web` — operator/admin interface
- `apps/account-web` — end-user account interface
- `packages/sync-core` — cloud-side shared sync helpers

This repository should remain private because it is part of the paid managed service and contains account-management and operations-facing surface area.
