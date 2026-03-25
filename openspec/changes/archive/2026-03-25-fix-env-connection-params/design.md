## Context

`ManagedServerlessClient` in `lambda-fns/psql.ts` wraps `serverless-postgres` (which wraps `pg.Client`) as a singleton per Lambda container. The client reads connection tuning parameters from environment variables, but `.env.sample` contains four parameters from a previous config scheme that are never read, while the actual parameters are undocumented.

The RDS instance is `db.t3.micro` with ~87 `max_connections`. With `maxConnections` hardcoded to 80 in `psql.ts`, a single Lambda container could theoretically claim most of the available connections, leaving no headroom for admin/migration use.

## Goals / Non-Goals

**Goals:**
- Replace dead `.env.sample` params with the ones `ManagedServerlessClient` actually reads
- Make `maxConnections` configurable via env var with a safe default for `db.t3.micro`
- Provide sensible defaults tuned for spiky Lambda traffic on a micro instance

**Non-Goals:**
- Changing the connection pool architecture (no RDS Proxy, no PgBouncer)
- Modifying health check logic or connection lifecycle behavior
- Updating production `.env.*` files (operator responsibility)

## Decisions

### 1. New env var `PG_MAX_CONNECTIONS` replaces hardcoded `maxConnections: 80`

**Choice:** Read from `process.env.PG_MAX_CONNECTIONS` with fallback to `20`.

**Rationale:** `db.t3.micro` has ~87 max connections. Default of 20 leaves room for multiple concurrent Lambda containers plus admin connections. The `serverless-postgres` `maxConnections` setting is a guard — it checks `pg_stat_activity` and refuses to connect if total connections exceed this number. Setting it to 20 means each container self-limits, providing back-pressure during spikes.

**Alternative considered:** Keep at 80. Rejected because on a micro instance this effectively disables the guard (87 total slots, 80 threshold = only 7 for everything else).

### 2. Default `PG_CONNECTION_MAX_LIFETIME_MS` to `120000` (2 minutes)

**Choice:** Reduce from the current 10-minute default.

**Rationale:** For spiky traffic, shorter connection lifetimes mean frozen Lambda containers release their RDS connections faster. 2 minutes is long enough to cover a burst of requests within a warm container, but short enough that stale connections from idle containers get rotated.

### 3. Remove dead parameters, keep comments explaining each new one

**Choice:** Remove `max`, `timeout`, `idle_timeout`, `max_lifetime`. Add `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, `PG_CLIENT_DEBUG` with inline comments.

**Rationale:** The dead params create confusion — they look tunable but have no effect. The replacement params match exactly what `psql.ts` reads.

## Risks / Trade-offs

- **[Risk] Lowering `maxConnections` from 80 to 20 could cause connection refusal under high concurrency** → Mitigated by the fact that `serverless-postgres` retries with delay (`delayMs: 3000`, `maxRetries: 3`). Containers will wait and retry rather than fail immediately. Monitor `53300` (too many connections) errors after deploy.
- **[Risk] Shorter `max_lifetime` (2 min vs 10 min) increases connection churn** → Acceptable trade-off for a micro instance. Connection establishment is ~10-20ms. The benefit of freeing stale connections outweighs the reconnection cost.
- **[Risk] Existing `.env.prod` / `.env.test` files won't have the new params** → These will fall back to code defaults. No breaking change — behavior only changes if operators explicitly set the new env vars.
