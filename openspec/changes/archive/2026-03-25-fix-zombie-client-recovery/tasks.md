## 1. Fix health check timeout recovery in psql.ts

- [x] 1.1 Add `'HEALTH_CHECK_TIMEOUT'` to `CONNECTION_ERROR_CODES` set in `psql.ts`
- [x] 1.2 Change `DEFAULT_MAX_CONNECTIONS` from `20` to `80`

## 2. Update env config files

- [x] 2.1 Update `.env.sample` — change `PG_MAX_CONNECTIONS` to `'80'` and update comment to explain it controls `clean()` threshold
- [x] 2.2 Update `.env.prod` — change `PG_MAX_CONNECTIONS` to `'80'` and update comment

## 3. Verify

- [x] 3.1 Run TypeScript compilation (`npx tsc --noEmit`) to confirm no type errors
