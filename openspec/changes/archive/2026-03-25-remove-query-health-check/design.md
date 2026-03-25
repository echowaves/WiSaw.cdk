## Context

The `ManagedServerlessClient` in `lambda-fns/psql.ts` wraps `serverless-postgres` and provides connection management, health checking, and auto-reconnection. Currently, both `connect()` and `query()` run health checks — `connect()` always does a forced check, while `query()` does an interval-based check (every 30s by default). All controllers follow the `connect → query → clean` pattern, meaning the connection is always health-checked by `connect()` before any queries run.

The pg driver's `Client` object has an internal state machine that transitions through `idle → query → idle` states. When a `SELECT 1` health check's Promise resolves, the driver may not have fully processed the `ReadyForQuery` wire-protocol message. If `query()` immediately issues another `client.query()` call, pg sees it as overlapping — triggering the deprecation warning.

## Goals / Non-Goals

**Goals:**
- Eliminate the `DeprecationWarning` by removing the race condition between health check and user query inside `query()`
- Preserve connection safety — `connect()` still validates the connection before use
- Preserve error-recovery — the retry path in `query()` still does a forced health check after reconnection

**Non-Goals:**
- Changing the health check interval, timeout, or mechanism
- Altering the `connect()` behavior
- Adding new health check strategies (e.g., background timers)
- Fixing the pg driver's internal state machine

## Decisions

### Remove `runHealthCheck()` from query(), keep it in connect() and error-retry

The `query()` method currently calls `await this.runHealthCheck()` before executing the user query. This is redundant because:
1. Every controller calls `psql.connect()` first, which does a forced health check
2. The health check and user query share the same underlying pg `Client`, creating a race window

The error-retry path (`this.runHealthCheck(true)` after reconnection) is kept because it validates the freshly-created connection before retrying.

**Alternatives considered:**
- Adding `await new Promise(resolve => setImmediate(resolve))` between health check and user query — this would let the event loop drain, but it's a fragile workaround that adds latency to every query
- Moving health checks to a background timer — more complex, and unnecessary since `connect()` already covers it

## Risks / Trade-offs

- **[Stale connection not detected mid-invocation]** → If a Lambda invocation makes many queries over a long period (minutes) without calling `connect()` again, a connection drop between queries would only be caught by the error-retry path rather than proactively by a health check. **Mitigation**: The error-retry path already handles this: on connection error, it reconnects, health-checks, and retries once.
- **[Behavior change for code that skips connect()]** → If any code path calls `psql.query()` without a prior `psql.connect()`, the connection won't be health-checked. **Mitigation**: All existing controllers follow the `connect → query → clean` pattern. `ensureConnected()` inside `query()` still guarantees a connection exists.
