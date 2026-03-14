## Context

The `improve-wave-grouping-quality` change introduced absorb paths where photos are assigned to existing waves instead of creating new ones. These paths return `waveUuid: null` and `name: null`, which the client doesn't expect — it uses `waveUuid` as a React FlatList key.

## Goals / Non-Goals

**Goals:**
- `AutoGroupResult.waveUuid` is non-null whenever `photosGrouped > 0`
- Client can navigate to the "primary" wave that received absorbed photos

**Non-Goals:**
- GraphQL schema changes
- Client-side code changes (server fix is sufficient)

## Decisions

### Decision 1: Return the wave that received the most photos

`assignPhotosToNearestWave` currently returns `number` (count of assigned photos). Change it to return `{ assigned: number, primaryWaveUuid: string, primaryWaveName: string }` — where `primaryWaveUuid` is the wave that received the most photo assignments. This gives callers meaningful data to return in the `AutoGroupResult`.

To get the wave name, query it from the `Waves` table since we already have the UUID.

## Risks / Trade-offs

- **[One extra query to get wave name]** → Negligible cost. Only happens on the absorb path (one query per invocation).
