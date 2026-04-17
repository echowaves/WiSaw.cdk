## Why

Production invocations are failing during `psql.connect()` because the forced health check can run on a stale warm-container socket and throw before business queries execute. The query path already has connection-error recovery and retry logic, so this preflight check is redundant and increases failure risk.

## What Changes

- Remove the forced `runHealthCheck(true)` call from `ManagedServerlessClient.connect()` in `lambda-fns/psql.ts`.
- Preserve existing query-time recovery behavior (`handleConnectionFailure` -> reconnect -> forced health check -> retry query).
- Keep controller lifecycle usage (`connect -> query -> clean`) unchanged.
- Update OpenSpec requirements for DB access behavior to reflect that health checks are not executed as a forced connect preflight.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `database-access-patterns`: clarify that connection validation/recovery is driven by query execution and retry path, not by a forced health-check query in `connect()`.

## Impact

- Affected code: `lambda-fns/psql.ts`.
- Affected behavior: fewer connect-time failures from stale sockets; first business query remains responsible for triggering retry/recovery.
- No GraphQL schema/resolver changes.
- No dependency changes.
