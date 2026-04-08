## Context

The backend exposes 12 wave-related queries and 17 mutations. To view a single wave's settings, clients must either use `listWaves` (which filters from the user's membership list and returns paginated results) or trigger a mutation. There is no targeted, side-effect-free way to fetch one wave by UUID.

Existing query controllers follow a consistent pattern: parameterised SQL via `psql.query()`, result mapping with `plainToClass`, and helper utilities (`_getWaveRole`, `_isWaveFrozen`) for cross-cutting concerns.

## Goals / Non-Goals

**Goals:**
- Provide a `getWave` query that returns a single wave by UUID with the caller's role, frozen state, recent photos, and join URL — matching the shape already returned by `listWaves`
- Keep the query strictly read-only: no writes, no side effects
- Follow the established controller pattern so maintenance cost is minimal

**Non-Goals:**
- Public/unauthenticated access — the caller must have a user UUID
- Returning the full photo set — recent photos (up to 5) match the `listWaves` behaviour
- Access control changes — any authenticated user who is a member can query; non-members receive the wave without `myRole`

## Decisions

**1. Return shape reuses the existing `Wave` type**
The `Wave` GraphQL type already carries every field the client needs (`myRole`, `isFrozen`, `photos`, `joinUrl`). No new types are required.

*Alternative considered:* A slimmer `WaveSettings` type — rejected because it would diverge from `listWaves` output and complicate the client.

**2. Non-members receive the wave with `myRole: null`**
Rather than throwing an error for non-members, return the wave data with `myRole` set to `null`. This matches how open waves work and lets the client decide how to handle access.

*Alternative considered:* Returning an authorization error for non-members — rejected because some waves are open, and clients need to check wave details before deciding to join.

**3. Wave not found returns `null`**
Following GraphQL conventions, a missing UUID returns `null` rather than throwing. The schema marks the return type as nullable (`Wave` not `Wave!`).

**4. Controller follows the `listWaves` data-fetching pattern**
Fetch the wave row, look up the caller's role, fetch up to 5 recent active photos, compute `isFrozen` and `joinUrl`. This keeps the response consistent across queries.

## Risks / Trade-offs

- **[Risk] Inconsistent photo count between `getWave` and `listWaves`** → Both use the same "top 5 active photos" sub-query, so they stay aligned by construction.
- **[Trade-off] Non-members can view any wave's metadata** → Acceptable for the current product model where waves are discoverable. If private waves are introduced later, access control can be layered on.
