## Context

`ManagedServerlessClient` in `lambda-fns/psql.ts` currently performs a forced `runHealthCheck(true)` during `connect()`. In warm Lambda containers with stale sockets, this preflight can fail before any business query runs, causing invocation failures. At the same time, `query()` already includes connection-error recovery (`handleConnectionFailure` -> reconnect -> forced health check -> retry).

The codebase consistently uses `connect -> query -> clean` in controllers, so removing forced preflight from `connect()` does not remove query execution safeguards.

## Goals / Non-Goals

**Goals:**
- Remove the forced health-check query from `connect()` to reduce stale-socket invocation failures.
- Keep existing query-time retry/recovery behavior unchanged.
- Preserve current controller call pattern and public APIs.

**Non-Goals:**
- Redesigning connection pooling strategy.
- Changing GraphQL handlers, schema, or resolver mappings.
- Introducing new dependencies or new runtime services.

## Decisions

### Decision: Remove forced health check from connect()
`connect()` will only ensure connectivity establishment (`ensureConnected()`) and will not run `runHealthCheck(true)`.

Rationale:
- The preflight health check is redundant because all practical paths issue a business query immediately after `connect()`.
- The query path already has robust retry logic that is better positioned to recover while preserving request intent.
- Removing the preflight avoids failure mode where stale warm sockets fail before retry path can run.

Alternative considered:
- Keep forced connect health check and add extra retry in `connect()`. Rejected because it keeps duplicate query activity and complexity in both `connect()` and `query()` while preserving an unnecessary preflight phase.

### Decision: Keep query-time forced health check in retry path
When `query()` detects connection errors, it will continue to reconnect, run forced health check, and retry the user query.

Rationale:
- This validates newly re-established connections before replaying user SQL.
- It preserves current resilience behavior and limits scope of change.

Alternative considered:
- Remove all health checks entirely. Rejected due to reduced confidence when retrying after reconnection.

## Risks / Trade-offs

- [Risk] First business query now becomes the earliest point stale sockets are detected.
  -> Mitigation: Existing retry path already handles this path and preserves user-level operation semantics.

- [Risk] Any future code path that calls `connect()` but never executes `query()` would no longer trigger a health-check query.
  -> Mitigation: Current codebase pattern is `connect -> query -> clean`; add regression tests and code review checks around DB lifecycle conventions.

- [Risk] pg deprecation warning related to concurrent query activity may still occur in other scenarios.
  -> Mitigation: Monitor logs post-rollout; this change targets connect preflight failures specifically.
