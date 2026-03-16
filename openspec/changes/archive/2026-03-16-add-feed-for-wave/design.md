## Context

Four feed controllers (`feedByDate`, `feedRecent`, `feedForWatcher`, `feedForTextSearch`) each contain identical conditional logic: if an optional `waveUuid` is present, JOIN `WavePhotos` and filter. This duplicates wave-filtering across four files. The client already knows whether it's browsing a wave, so a dedicated query is a cleaner contract.

The new `feedForWave` controller will follow the `feedForWatcher` pattern — page-number pagination, `row_number()` window function, `updatedAt` ordering, 100-photo pages — replacing `Watchers` JOIN with `WavePhotos` JOIN.

## Goals / Non-Goals

**Goals:**
- Create `feedForWave` as a dedicated paginated GraphQL query for wave photos.
- Remove `waveUuid` parameter and conditional wave-filtering from all four existing feed queries.
- Use parameterized SQL queries (`$1`, `$2`) for `waveUuid` in the new controller to avoid SQL injection.
- Use UUID validation on the `waveUuid` input.

**Non-Goals:**
- Adding geo-distance calculation to wave feeds (wave's own location is not used for photo ordering).
- Changing pagination strategy (keeping page-number based, not cursor-based).
- Backward-compatible rollout — this is a coordinated breaking change deployed with the client update.

## Decisions

1. **Model after `feedForWatcher`** — Same pagination mechanics (page-number × limit = offset, LIMIT 100, `row_number()` window, `updatedAt` DESC ordering). This is the closest existing pattern. Alternative: model after `feedRecent` (simpler, no `row_number()`), but `feedForWatcher` already demonstrates the JOIN-based feed pattern we need.

2. **Use parameterized queries** — The existing feed controllers interpolate values directly into SQL strings, which is an injection risk. The new `feedForWave` will use `$1` parameterized queries for `waveUuid`. Not refactoring existing controllers' SQL (non-goal).

3. **Validate `waveUuid` with `uuid` library** — Consistent with other wave controllers (`addPhoto`, `removePhoto`, `deleteWave`). Throw clear error on invalid format.

4. **Place in `lambda-fns/controllers/photos/`** — Although it queries by wave, the return type is `PhotoFeed` (photos), so it belongs with photo controllers, not wave controllers. Consistent with file naming convention: controller file matches GraphQL field name (`feedForWave.ts`).

5. **Breaking schema change** — Remove `waveUuid: String` from all four existing queries simultaneously. No deprecation period since server and RN client deploy together.

## Risks / Trade-offs

- **[Medium] Coordinated deploy required** → Client and server must deploy together. If the client calls `feedRecent(waveUuid: ...)` after the server removes the parameter, it will fail. Mitigation: deploy server first (AppSync ignores unknown arguments by default in some configurations), or deploy both simultaneously.

- **[Low] No fallback if `feedForWave` has a bug** → The old wave-filtering paths will be removed. Mitigation: the new controller is simple and testable; the SQL is straightforward.
