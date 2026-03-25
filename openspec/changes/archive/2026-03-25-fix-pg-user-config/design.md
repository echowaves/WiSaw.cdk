## Context

The `.env.*` config files export a flat object with `username` (Sequelize convention). CDK spreads this object into Lambda environment variables. The `psql.ts` singleton spreads `process.env` into the `serverless-postgres` constructor, which passes it directly to `pg.Client`. The `pg` driver only recognizes `user` — it ignores `username`. On Lambda runtimes (Amazon Linux 2023 / Node.js 22.x), pg's fallback chain (`PGUSER` → `USER` env → `os.userInfo().username`) resolves to an empty or invalid value, causing a `28000` authentication error.

Separately, `config/config.js` (Sequelize migrations) reads `cfg.username` — this key must remain in `.env.*` files.

## Goals / Non-Goals

**Goals:**
- Fix production: ensure `pg.Client` receives a valid `user` field
- Maintain backward compatibility with Sequelize migrations (`config/config.js` reads `username`)

**Non-Goals:**
- Refactoring the env config architecture
- Removing `username` from `.env.*` files
- Changing how CDK passes environment variables to Lambdas

## Decisions

### Map `username` → `user` at the psql.ts singleton

Add `user: env.username` to the singleton config object. This ensures `pg.Client` receives the `user` field it expects regardless of what the `.env.*` files use.

**Alternative considered**: Add `user` to `.env.*` alongside `username` and rely on CDK spreading it into the Lambda env. Rejected as the only fix because Lambda env vars come from `process.env` — the singleton already spreads `...env` — but adding `user` to `.env.*` alone doesn't guarantee the singleton config receives it (it would come via `process.env.user` which is lowercase and distinct from the config object key). The explicit mapping in `psql.ts` is the authoritative fix.

**Alternative considered**: Rename `username` → `user` everywhere. Rejected because `config/config.js` (Sequelize) requires `username`.

### Also add `user` to `.env.*` files

As a secondary measure, add `user` alongside `username` in `.env.sample` and `.env.prod`. This makes the env config self-documenting and ensures the `user` key is available if any code path reads directly from the config.

## Risks / Trade-offs

- [Both `user` and `username` exist in `.env.*`] → Acceptable trade-off: `username` is for Sequelize, `user` is for pg. A comment clarifies the dual presence.
- [No risk of double-mapping] → `user: env.username` in psql.ts is a simple override; if `env.user` already exists from the spread, the explicit `user: env.username` takes precedence since it comes after `...env`.
