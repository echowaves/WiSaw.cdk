## 1. Fix null-handling in updateWave resolver

- [x] 1.1 Change the frozen-wave guard (`hasNonFreezeChanges`) to use `!= null` instead of `!== undefined` for all optional fields
- [x] 1.2 Change the `name` field check from `name !== undefined && name !== null` to `name != null`
- [x] 1.3 Change the `description` field check to use `!= null` and map empty string `""` to `NULL` in the database
- [x] 1.4 Change the `lat`/`lon` field checks from `!== undefined` to `!= null`
- [x] 1.5 Change the `open` field check from `!== undefined` to `!= null`
- [x] 1.6 Change the `splashDate` field check from `!== undefined` to `!= null`
- [x] 1.7 Change the `freezeDate` field check from `!== undefined` to `!= null`

## 2. Validation

- [x] 2.1 Verify the name empty-string validation still works correctly with the new null check
- [x] 2.2 Run existing tests to confirm no regressions
