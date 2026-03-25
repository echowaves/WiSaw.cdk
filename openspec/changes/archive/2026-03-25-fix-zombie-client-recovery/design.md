## Context

After changing `PG_MAX_CONNECTIONS` from 80 to 20 and redeploying, production entered a permanent failure state. Every request fails with `HealthCheckTimeoutError` after 5 seconds.

The failure chain:
1. `serverless-postgres` `clean()` uses `maxConnections × connUtilization (0.8)` as the threshold to start killing idle connections. At 20, that's 16 — easily hit by a few concurrent Lambda containers.
2. `clean()` kills other containers' idle connections via `pg_terminate_backend`.
3. `serverless-postgres` swallows the termination error event but leaves `_client` set (not nulled).
4. `ManagedServerlessClient.hasActiveClient()` returns `true` for this zombie client.
5. `ensureConnected()` skips reconnection.
6. `runHealthCheck(true)` sends `SELECT 1` on the dead connection, which hangs until the 5-second timeout.
7. The `HEALTH_CHECK_TIMEOUT` error code is NOT in `CONNECTION_ERROR_CODES`, so `isConnectionError()` returns false.
8. The zombie client is never replaced. Container is permanently bricked.

## Goals / Non-Goals

**Goals:**
- Recover from health check timeouts by treating them as connection errors
- Restore a safe `PG_MAX_CONNECTIONS` default that doesn't trigger aggressive `clean()` behavior
- Prevent permanent container bricking from zombie connections

**Non-Goals:**
- Fixing the `serverless-postgres` library itself (upstream bug — it should null out `_client` on termination)
- Changing the `clean()` behavior or connection utilization threshold
- Adding RDS Proxy or external connection pooling

## Decisions

### 1. Add `HEALTH_CHECK_TIMEOUT` to connection error handling

**Choice:** Add the code `'HEALTH_CHECK_TIMEOUT'` to `CONNECTION_ERROR_CODES` in `psql.ts`.

**Rationale:** A health check timeout means the connection is unresponsive — it should be treated identically to other connection failures. This triggers `handleConnectionFailure()` → `restartClient()`, which creates a fresh `ServerlessClient` instance with a new `pg.Client`, breaking the zombie cycle.

**Alternative considered:** Handle it specially in `performHealthCheck()` instead of the general error codes set. Rejected because the fix is simpler and more robust when all timeout scenarios trigger the standard reconnection path.

### 2. Revert `PG_MAX_CONNECTIONS` default to 80

**Choice:** Change `DEFAULT_MAX_CONNECTIONS` back to 80. Update `.env.sample` and `.env.prod`.

**Rationale:** `PG_MAX_CONNECTIONS` does NOT mean "max connections per container." It's `serverless-postgres`'s `maxConnections` parameter, which controls when `clean()` starts killing idle connections. At 80 with `connUtilization: 0.8`, the threshold is 64 — safely above typical usage on a micro instance. The value 20 was chosen based on an incorrect understanding of the parameter's purpose.

## Risks / Trade-offs

- **[Risk] `maxConnections: 80` on a micro instance (~87 max) means `clean()` only kicks in at 64 connections** → Acceptable. `clean()` is a best-effort cleanup, not a hard limit. The real connection guard is RDS's `max_connections`.
- **[Risk] `HEALTH_CHECK_TIMEOUT` in `CONNECTION_ERROR_CODES` means any health check timeout triggers reconnection** → This is the desired behavior. A timed-out health check means the connection is dead or extremely slow — reconnection is the correct response either way.
