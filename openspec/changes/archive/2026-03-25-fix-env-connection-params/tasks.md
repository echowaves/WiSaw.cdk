## 1. Update psql.ts to read PG_MAX_CONNECTIONS from env

- [x] 1.1 Add `PG_MAX_CONNECTIONS` parsing via `parsePositiveInt(env.PG_MAX_CONNECTIONS, 20)` in `ManagedServerlessClient` constructor
- [x] 1.2 Replace hardcoded `maxConnections: 80` with the parsed value in the client config at bottom of file

## 2. Update .env.sample with correct parameters

- [x] 2.1 Remove dead parameters (`max`, `timeout`, `idle_timeout`, `max_lifetime`) from `.env.sample`
- [x] 2.2 Add `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, `PG_CLIENT_DEBUG` with inline comments and micro-instance defaults

## 3. Verify

- [x] 3.1 Run TypeScript compilation (`npx tsc --noEmit`) to confirm no type errors
