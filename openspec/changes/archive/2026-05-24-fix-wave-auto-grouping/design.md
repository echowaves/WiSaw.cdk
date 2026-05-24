## Context

The `autoGroupPhotosIntoWaves` mutation groups a user's ungrouped photos into waves based on geographic locality and a `groupingLevel` parameter (DISTRICT, CITY, REGION, COUNTRY). The current algorithm walks photos chronologically and breaks the wave on the first photo that doesn't match the locality key. This causes wave fragmentation when photos have null or inconsistent geocoding data from AWS Location Service — a single null-country photo splits what should be one wave into three.

The algorithm also has no temporal scoping — a single wave can span years of photos in the same locality.

## Goals / Non-Goals

**Goals:**
- Eliminate wave fragmentation caused by null/inconsistent geocoding data
- Scope waves to calendar seasons (max ~3 months, max 1000 photos)
- Each mutation call processes one locality's worth of photos, skipping non-matching ones
- Remove silent `groupingLevel` default fallback

**Non-Goals:**
- Changing the `GroupingLevel` enum or field-matching rules
- Changing the distance fallback mechanism (`_filterPhotosInRadius`)
- Hemisphere-aware seasons (calendar seasons are location-independent)
- Retroactively re-grouping existing waves

## Decisions

### Decision 1: Skip non-matching photos instead of breaking

**Choice**: When a photo doesn't match the active wave's locality key, skip it (leave ungrouped) and continue scanning for matches.

**Alternative considered**: "Group-then-order" bucket approach — GROUP BY locality fields, one wave per bucket. Simpler but loses chronological processing semantics and would require a fundamentally different algorithm structure.

**Rationale**: Skip-and-continue preserves the existing chronological walk pattern, is a minimal change to the core loop, and naturally handles the multi-iteration client flow (each call handles one locality, client calls until `hasMore=false`).

### Decision 2: Calendar-based seasons, year-keyed to season start

**Choice**: Seasons are calendar/meteorological (not astronomical):
- Winter: Dec, Jan, Feb
- Spring: Mar, Apr, May
- Summer: Jun, Jul, Aug
- Fall: Sep, Oct, Nov

Season key format: `"YYYY-SEASON"` where YYYY is the year the season starts. December belongs to that year's winter (Dec 2025 → `"2025-WINTER"`, Jan 2026 → `"2025-WINTER"`).

**Alternative considered**: Astronomical seasons (solstice/equinox dates). Rejected — adds complexity for no user-facing benefit.

**Alternative considered**: Hemisphere-aware seasons. Rejected — introduces location dependency into temporal logic and the user confirmed calendar-based is acceptable.

### Decision 3: Wave naming changes to season format

**Choice**: Wave names use `"<LocalityName>, <Season> <Year>"` format (e.g., `"New York, Winter 2025"`). The year in the name is the season-start year.

**Previous format**: `"New York, Mar – Jun 2026"` using date range.

**Rationale**: Simpler, consistent with the season-scoping model. The `computeWaveNameFromKey` function and final UPDATE query need to produce this format.

### Decision 4: 1000-photo wave limit

**Choice**: When a wave accumulates 1000 photos, close it and start a new wave for the same locality/season. The new wave gets a disambiguated name or the same name (two waves can share a name).

**Rationale**: Prevents excessively large waves that would be unwieldy in the UI. 1000 is large enough for typical use while capping outliers.

### Decision 5: Remove groupingLevel default

**Choice**: Remove `const gl = groupingLevel ?? DEFAULT_GROUPING_LEVEL`. If `groupingLevel` is somehow undefined/null, throw an error. The GraphQL schema already enforces `GroupingLevel!` so this is defense-in-depth.

## Risks / Trade-offs

- **[More mutation calls needed]** → Each call processes one locality. A user with photos in 5 countries at COUNTRY level needs ~5 calls. Mitigated by existing `hasMore` loop on the client.
- **[Null-geo photos accumulate]** → Photos with all-null locality fields are skipped by every locality-anchored wave. They get grouped only when they're the first ungrouped photo (creating a coordinate-named wave). Acceptable — these waves may overlap temporally with geo-named waves.
- **[Season boundary splits nearby photos]** → A photo on Feb 28 and March 1 end up in different waves (Winter vs Spring). Acceptable — clean season boundaries are a feature, not a bug.
- **[Existing waves unaffected]** → This changes only the auto-grouping algorithm. Previously created waves retain their old naming/structure. No migration needed.
