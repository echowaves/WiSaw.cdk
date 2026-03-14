## Context

The `fix-wave-grouping` change introduced a loop in `autoGroupPhotosIntoWaves` that iterates through all temporal clusters sequentially, calling Nominatim reverse geocoding for each one until a successful result is found. Each HTTP call takes 1-3 seconds. When a user has many clusters and early ones fail geocoding (ocean points, unpopulated areas), the cumulative latency exceeds the AppSync 30-second timeout.

The original code geocoded exactly one cluster per invocation. The fix must restore that behavior.

## Goals / Non-Goals

**Goals:**
- Restore constant-time execution: at most ONE external HTTP call per invocation
- Still handle geocoding failures gracefully (no coordinate-based names)
- Preserve the locationless-photo-to-nearest-wave assignment on the final pass

**Non-Goals:**
- Retrying failed geocoding on subsequent invocations
- Parallel geocoding of multiple clusters
- Changing Lambda or AppSync timeout settings

## Decisions

### Decision 1: Geocode only the oldest cluster — use "Uncategorized" on failure

Instead of looping through clusters, geocode only the oldest temporal cluster (matching original behavior). If geocoding fails, name the wave `"Uncategorized, <DateRange>"` and create it anyway.

**Why not skip the cluster?** Skipping creates two problems:
1. We'd need to loop to find a geocodable one (the current timeout issue)
2. Skipped photos would need tracking to avoid infinite re-processing on subsequent calls

Creating the wave immediately with a fallback name means:
- One HTTP call max per invocation
- Every invocation makes progress (no infinite loops)
- Wave gets created with NULL location (same as catch-all waves)
- User can rename the wave later if desired

**Alternative considered**: Skip the failed cluster, mark its photos, process them later — rejected because it adds tracking complexity and still risks multiple geocoding calls if many clusters fail.

### Decision 2: handleUnresolvablePhotos only handles locationless photos

The `handleUnresolvablePhotos` function runs only when there are no located ungrouped photos left. At that point, it handles locationless photos by assigning them to the nearest wave in time (or creating catch-all waves). No geocoding is involved in this path, so no timeout risk.

Geocoding-failed clusters no longer feed into `handleUnresolvablePhotos` — they get their own `"Uncategorized"` wave immediately.

## Risks / Trade-offs

- **[Some waves will be named "Uncategorized" for areas where geocoding fails]** → Acceptable trade-off. Users can rename waves. This is better than timing out entirely.
- **[Geocoding-failed waves get NULL location geometry]** → Same behavior as existing catch-all waves. No functional impact since wave location is informational.
