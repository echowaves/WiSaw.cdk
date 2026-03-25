## Why

The `.env.sample` contains four dead connection pool parameters (`max`, `timeout`, `idle_timeout`, `max_lifetime`) that are not consumed by `ManagedServerlessClient` in `psql.ts`. Meanwhile, the four parameters the client actually reads (`PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, `PG_CLIENT_DEBUG`) are missing from the config. This creates a false sense of control — anyone tuning the dead params gets no effect, and the real tunables are invisible.

Additionally, the hardcoded `maxConnections: 80` in `psql.ts` is too high for an RDS `db.t3.micro` instance (~87 max connections), leaving almost no headroom for admin connections or migration tooling.

## What Changes

- Remove dead parameters from `.env.sample`: `max`, `timeout`, `idle_timeout`, `max_lifetime`
- Add the parameters `ManagedServerlessClient` actually reads: `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, `PG_CLIENT_DEBUG`
- Make `maxConnections` in `psql.ts` configurable via a new `PG_MAX_CONNECTIONS` env var instead of hardcoded to 80
- Set defaults tuned for a `db.t3.micro` RDS instance with spiky Lambda traffic

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `database-access-patterns`: Adding configurable `maxConnections` via env var and documenting the correct connection pool parameters

## Impact

- `config/config.js` or `.env.sample`: parameter list changes
- `lambda-fns/psql.ts`: `maxConnections` becomes configurable via `PG_MAX_CONNECTIONS`
- All `.env.*` files: need updated with new parameter names
- No API or schema changes
- No dependency changes
