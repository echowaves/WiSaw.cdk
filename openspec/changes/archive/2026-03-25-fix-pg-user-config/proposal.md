## Why

Production is completely broken with PostgreSQL error `28000: no PostgreSQL user name specified in startup packet` on every request. The `.env.*` config files use `username` (Sequelize convention) but `pg.Client` and `serverless-postgres` expect `user`. Neither library maps `username` → `user`. On Lambda, pg's fallback chain (`PGUSER` env → `USER` env → `os.userInfo().username`) resolves to an empty or invalid value, causing the startup packet to omit the user entirely.

## What Changes

- Map `username` → `user` in the `psql.ts` singleton config so `pg.Client` receives the correct field name
- Add `user` alongside `username` in `.env.sample` and `.env.prod` so the pg-expected key is present in the Lambda environment
- Keep `username` in `.env.*` files to preserve backward compatibility with `config/config.js` (Sequelize migrations)

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `database-access-patterns`: Add requirement that the singleton config must explicitly map `user` from `username` for pg driver compatibility

## Impact

- **Code**: `lambda-fns/psql.ts` — singleton instantiation
- **Config**: `.env.sample`, `.env.prod` — add `user` field
- **Systems**: All Lambda functions using the psql singleton (every AppSync resolver + standalone lambdas)
- **Risk**: Minimal — additive change, no removal of existing fields
