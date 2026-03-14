## Context

The auto-grouping algorithm processes one temporal cluster per invocation (to stay under the AppSync 30-second timeout). It geocodes the oldest cluster's centroid. If geocoding fails, it creates an "Uncategorized" wave. This produces many small waves with no location name — especially for photos taken at sea, in remote areas, or where Nominatim simply has no data.

The algorithm already has logic to assign locationless photos to the nearest wave in time (`handleUnresolvablePhotos`). The same approach should be used for geocoding-failed clusters.

## Goals / Non-Goals

**Goals:**
- Most waves should have a geocoded location name
- Photos from geocoding-failed clusters should be absorbed into the nearest named wave in time
- Maintain the one-HTTP-call-per-invocation constraint (no timeouts)
- Every invocation must make progress (no infinite loops)

**Non-Goals:**
- Changing the spatial clustering algorithm (DBSCAN parameters)
- Retrying geocoding for previously-failed locations
- Re-naming existing "Uncategorized" waves from prior runs

## Decisions

### Decision 1: Two-pass processing within each invocation

Each invocation does:

1. **Geocode the oldest unprocessed cluster** (one HTTP call)
2. **If geocoding succeeds**: Create a named wave, assign the cluster's photos, return.
3. **If geocoding fails**: Don't create a wave. Instead, check if existing waves exist for the user:
   - **If waves exist**: Assign the failed cluster's photos to the nearest existing wave by time proximity (reuse `handleUnresolvablePhotos` logic). Return with `hasMore` based on remaining ungrouped photos.
   - **If no waves exist**: Skip this cluster for now. Don't assign its photos yet. Return `hasMore: true` so the client calls again on the next cluster.

This way, on the next invocation, the next-oldest cluster is tried. Eventually either:
- A cluster geocodes successfully → named wave created → subsequent failed clusters get absorbed into it
- All clusters fail → on the final invocation (no clusters left), `handleUnresolvablePhotos` creates the "Uncategorized" catch-all

**Why not just skip and retry?** We need to avoid an infinite loop. "Skipping" works because each invocation processes the oldest cluster. If it fails, the photos stay ungrouped, but the NEXT invocation will pick the next-oldest cluster (different centroid, different geocoding chance). The concern is: won't it pick the SAME cluster again? It will — because DBSCAN is deterministic over the same set of ungrouped photos. 

**Fixing the infinite loop**: When geocoding fails and no existing waves exist, we must still make progress. The solution: assign the failed cluster's photos to a temporary holding state. But we don't have a holding state...

### Decision 1 (revised): Single skip with progress tracking via cluster ordering

Actually, the DBSCAN clustering IS deterministic over the same photo set. If we skip the oldest cluster, the next invocation will produce the same clusters and pick the same oldest one again → infinite loop.

The correct approach:

1. **Geocode the oldest cluster** (one HTTP call)
2. **If success**: Create named wave → done
3. **If failure AND existing waves exist**: Assign photos to nearest wave in time → done (photos removed from ungrouped pool, no infinite loop)
4. **If failure AND no existing waves exist**: Create "Uncategorized" wave → done (photos removed from ungrouped pool, no infinite loop)

This is almost the current behavior, except for case 3: instead of always creating an "Uncategorized" wave, we absorb into an existing named wave when possible.

The key insight: "Uncategorized" waves only proliferate when waves already exist (because then each failed cluster creates a new tiny wave). When no waves exist at all, a single "Uncategorized" catch-all is acceptable. So the fix is specifically: **when geocoding fails and named waves already exist, absorb instead of creating a new wave.**

### Decision 2: Reuse handleUnresolvablePhotos for geocoding-failed clusters

The existing `handleUnresolvablePhotos` function already:
- Queries existing waves with their date ranges
- Computes time-distance midpoints
- Assigns photos to the nearest wave

We can reuse this logic directly for geocoding-failed cluster photos. The only difference: these photos DO have locations (they were spatially clustered), but their location name couldn't be resolved. From a wave-assignment perspective, they're treated identically to locationless photos.

## Risks / Trade-offs

- **[Geocoding-failed photos may end up in a geographically unrelated wave]** → Acceptable trade-off. The alternative (many tiny "Uncategorized" waves) is worse UX. Users can manually move photos.
- **[First invocation may still create "Uncategorized" if no waves exist]** → Unavoidable. On subsequent invocations, most clusters will either geocode successfully or be absorbed. The single "Uncategorized" wave is acceptable as a seed.
- **[Absorbed photos change the date range of the target wave]** → The wave's stored metadata isn't updated (no date range stored on the wave itself, just photo associations). Wave name remains based on the original cluster. This is fine.
