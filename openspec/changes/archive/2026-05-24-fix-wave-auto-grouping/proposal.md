## Why

The auto-grouping algorithm creates too many waves because it breaks the current wave on the first chronologically-encountered photo that doesn't match the locality key. A single photo with null or different geocoding data fractures what should be one continuous wave into multiple fragments. Additionally, waves have no time-scope boundaries, allowing a single wave to span arbitrary date ranges.

## What Changes

- **Replace "break on first miss" with "skip non-matching"**: Non-matching photos are left ungrouped for subsequent iterations instead of breaking the wave. Each mutation call groups photos for one locality at a time.
- **Add season-based wave boundaries**: Each wave is scoped to a single calendar season (Winter: Dec-Feb, Spring: Mar-May, Summer: Jun-Aug, Fall: Sep-Oct). Season key format: `"YYYY-SEASON"` where year is the year the season starts (Dec 2025 → `"2025-WINTER"`).
- **Add wave photo count limit**: Each wave holds a maximum of 1000 photos. When the limit is reached, a new wave is created for the same locality and season.
- **Change wave naming to season-based**: Wave names change from `"NYC, Mar – Jun 2026"` to `"NYC, Spring 2026"`.
- **Remove `groupingLevel` default fallback**: The server-side handler must not silently default to `CITY`. Rely on GraphQL `GroupingLevel!` enforcement; throw if the value is missing. **BREAKING**

## Capabilities

### New Capabilities

- `season-wave-boundaries`: Season detection logic, season key computation (`"YYYY-SEASON"`), and season-based wave closing rules

### Modified Capabilities

- `auto-group-photos`: Replace break-on-first-miss with skip-non-matching; add season boundary and 1000-photo limit as wave closing triggers; remove `groupingLevel` default fallback; change wave naming to season format

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — core algorithm rewrite
- **Code**: `lambda-fns/controllers/waves/_autoGroupGeo.ts` — matching logic unchanged but called differently (skip vs break)
- **GraphQL**: No schema changes (already `GroupingLevel!`)
- **Client**: Multiple mutation calls may be needed (one per locality) — already supported via `hasMore` mechanism
- **Breaking**: Clients that omit `groupingLevel` and rely on server-side `CITY` default will fail (GraphQL already enforces `!`, so this should be a no-op in practice)
