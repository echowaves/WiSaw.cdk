## Why

Production Lambda logs show an intermittent `DeprecationWarning: Calling client.query() when the client is already executing a query` from the pg driver. Trace logging confirms it occurs when `ManagedServerlessClient.query()` runs its internal health check (`SELECT 1`) and then immediately fires the user query — the pg Client's internal state machine hasn't fully drained the health check before the next query arrives. This happens only when the Lambda container has been idle long enough for the health check interval to elapse (default 30s). The health check inside `query()` is redundant because every controller already calls `psql.connect()` first, which performs a forced health check. Removing it from `query()` eliminates the race condition.

## What Changes

- **Remove the health check call from `ManagedServerlessClient.query()`** in `lambda-fns/psql.ts` — the `await this.runHealthCheck()` line inside `query()` will be removed
- The forced health check in `connect()` remains unchanged — it continues to validate the connection before any queries
- The health check on error-retry path inside `query()` remains unchanged — after a connection failure, the retry still does a forced health check

## Capabilities

### New Capabilities

### Modified Capabilities
- `database-access-patterns`: The "Health check on query" requirement is being removed — `query()` will no longer run periodic health checks; only `connect()` does

## Impact

- **Code**: `lambda-fns/psql.ts` — single line removal in the `query()` method
- **Behavior**: Health checks now only run during `connect()` (forced) and during error-retry (forced). The periodic interval-based health check inside `query()` is eliminated.
- **Risk**: If a controller calls `psql.query()` without a prior `psql.connect()`, the connection won't be health-checked. All existing controllers follow the `connect → query → clean` pattern, so this is safe.
