## Why

The `listWaves` query currently sorts waves by `createdAt DESC`, but users on the waves details screen expect waves to be ordered by recency of activity — the most recently updated wave should appear first. A wave that was created months ago but had a photo added yesterday should surface above a freshly-created empty wave.

## What Changes

- Change the default sort order in `listWaves` from `Waves.createdAt DESC` to `Waves.updatedAt DESC`
- Update the `list-waves-sorting` spec to reflect the new requirement

## Capabilities

### Modified Capabilities

- `list-waves-sorting`: requirement changes from `createdAt DESC` to `updatedAt DESC`

## Impact

- `lambda-fns/controllers/waves/listWaves.ts` — ORDER BY clause
- `openspec/specs/list-waves-sorting/spec.md` — requirement text
