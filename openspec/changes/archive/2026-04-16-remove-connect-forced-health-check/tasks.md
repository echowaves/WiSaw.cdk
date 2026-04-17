## 1. Update DB client behavior

- [x] 1.1 Remove forced `runHealthCheck(true)` execution from `ManagedServerlessClient.connect()` in `lambda-fns/psql.ts`.
- [x] 1.2 Ensure `connect()` still performs connection establishment (`ensureConnected`) and preserves existing tracing/log semantics.

## 2. Preserve query-time resilience

- [x] 2.1 Confirm `ManagedServerlessClient.query()` keeps current connection-error handling flow (restart connection, validate, retry once).
- [x] 2.2 Verify no controller changes are required for the existing `connect -> query -> clean` lifecycle.

## 3. Validate behavior

- [x] 3.1 Run targeted checks/tests for DB access paths to ensure stale connection errors are recovered during query execution rather than connect preflight.
- [x] 3.2 Verify no new TypeScript/lint errors are introduced in `lambda-fns/psql.ts` and related call sites.

## 4. Rollout and observability

- [x] 4.1 Deploy and monitor Lambda logs for reduction in connect-time `Connection terminated` failures.
- [x] 4.2 Monitor pg warning frequency and confirm no increase in query failure rate post-deploy.
