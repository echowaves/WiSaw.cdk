## Context

Three utility scripts create their own `ServerlessClient` instances by spreading `.env.prod`'s config object. The config exports `username` (Sequelize convention), but `pg.Client` requires `user`. This was already fixed in `lambda-fns/psql.ts` with `user: env.username`, but the scripts were not updated because they bypass `ManagedServerlessClient`.

## Goals / Non-Goals

**Goals:**
- Fix the `username` → `user` mapping in all three scripts so they can connect to the production database

**Non-Goals:**
- Refactoring scripts to use `ManagedServerlessClient` — they run locally, not in Lambda
- Changing `serverless-postgres` or `pg` versions
- Fixing TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED`) — tracked separately in `enable-rds-tls-verification`

## Decisions

### Add `user: config.username` to each ServerlessClient constructor

**Choice**: Add explicit `user: config.username` alongside the existing `...config` spread.

**Rationale**: Minimal change, exactly mirrors the fix applied in `psql.ts`. The `user` property overrides whatever `...config` spread provides, so even if a future `.env` file adds a `user` field, the explicit mapping still works correctly.

**Alternative considered**: Change `.env.prod` to export `user` instead of `username` — rejected because `config/config.js` (Sequelize migrations) depends on `username`.

## Risks / Trade-offs

- **[None significant]** → This is a one-line fix per script. The scripts are local utilities, not deployed infrastructure.
