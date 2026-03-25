## 1. Remove health check from query()

- [x] 1.1 Remove the `await this.runHealthCheck()` call from `ManagedServerlessClient.query()` in `lambda-fns/psql.ts` — keep `ensureConnected()` and the error-retry health check intact

## 2. Verify

- [x] 2.1 Run TypeScript compilation check (`npx tsc --noEmit`) to confirm no build errors
