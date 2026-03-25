## Why

After lowering `PG_MAX_CONNECTIONS` from 80 to 20, production entered a permanent failure state: every Lambda invocation fails with `HealthCheckTimeoutError`. Two bugs compound:

1. **`clean()` becomes hyper-aggressive at low `maxConnections`** — `serverless-postgres` triggers connection killing when total connections exceed `maxConnections × 0.8`. At 20, that threshold is 16 — easily exceeded by a few concurrent Lambda containers. `clean()` then terminates other containers' idle connections via `pg_terminate_backend`.

2. **Health check timeout is not treated as a connection error** — when a terminated connection's health check times out, `ManagedServerlessClient` does not recognize `HEALTH_CHECK_TIMEOUT` as a connection error. The dead client is never replaced, permanently bricking the Lambda container.

## What Changes

- Treat `HEALTH_CHECK_TIMEOUT` as a connection error in `ManagedServerlessClient`, triggering client restart and reconnection
- Revert `PG_MAX_CONNECTIONS` default to `80` (matching previous behavior) since this value controls `serverless-postgres`'s `clean()` threshold, not per-container connection count
- Update `.env.sample` and `.env.prod` to reflect the corrected default

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `database-access-patterns`: Health check timeout SHALL be treated as a connection error; `PG_MAX_CONNECTIONS` default changes from 20 to 80

## Impact

- `lambda-fns/psql.ts`: Add `HEALTH_CHECK_TIMEOUT` to connection error detection; change `DEFAULT_MAX_CONNECTIONS` from 20 to 80
- `.env.sample`: Update `PG_MAX_CONNECTIONS` comment and value
- `.env.prod`: Update `PG_MAX_CONNECTIONS` value
- No API or schema changes
- No dependency changes
