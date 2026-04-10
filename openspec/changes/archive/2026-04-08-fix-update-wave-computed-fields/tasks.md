## 1. Add computed fields to updateWave response

- [x] 1.1 Add `DEEP_LINK_BASE_URL` env var reference to `update.ts`
- [x] 1.2 After `plainToClass`, set `isFrozen` using `_isWaveFrozen(result.rows[0])`
- [x] 1.3 Set `myRole` to `'owner'` on the returned wave object
- [x] 1.4 Compute `joinUrl` from `result.rows[0].open` and `DEEP_LINK_BASE_URL`

## 2. Validation

- [x] 2.1 Run existing tests to confirm no regressions
