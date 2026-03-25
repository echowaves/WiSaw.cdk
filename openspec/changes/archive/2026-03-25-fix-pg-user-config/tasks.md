## 1. Fix psql.ts singleton config

- [x] 1.1 Add `user: env.username` to the singleton `ManagedServerlessClient` config in `lambda-fns/psql.ts`, placed after the `...env` spread so it overrides any existing `user` key

## 2. Update env config files

- [x] 2.1 Add a comment to the `username` field in `.env.sample` noting that `psql.ts` maps it to `user` for pg driver compatibility
- [x] 2.2 Add a comment to the `username` field in `.env.prod` noting that `psql.ts` maps it to `user` for pg driver compatibility

## 3. Update spec

- [x] 3.1 Sync the `database-access-patterns` spec in `openspec/specs/database-access-patterns/spec.md` with the delta spec changes
