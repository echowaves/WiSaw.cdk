## Why

Auto-grouping has two issues that result in small, poorly-named waves. First, the batch limit of 200 means interleaved-location photos require many round trips to fill a single wave, and with the previous freeze bug each batch created a new wave capped at 200 photos. Aligning the batch limit with the 1000-photo wave cap ensures most waves fill in one invocation. Second, photos with null locality fields are counted as "unknown" in the frequency map, and when they outnumber photos with real locality data, the wave gets named "unknown, Season Year" instead of using the locality data that does exist.

## What Changes

- Raise `BATCH_LIMIT` from 200 to 1000 to match `MAX_PHOTOS_PER_WAVE`, reducing the number of client round trips needed to fill a wave
- Exclude null-locality photos (the "unknown" sentinel) from the most-frequent-locality calculation so that waves are named after the best available locality data, falling back to coordinate-based names only when zero photos have locality data

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `auto-group-photos`: Batch limit changes from 200 to 1000; wave name refinement excludes null-locality photos from frequency counting

## Impact

- **Code**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` — change `BATCH_LIMIT` constant; modify `getMostFrequentLocality` to skip "unknown" entries
- **Performance**: Each Lambda invocation processes up to 5x more photos; acceptable since no geocoding calls are made during auto-grouping (just DB reads, in-memory string matching, and bulk inserts)
- **Client**: Fewer round trips needed; `hasMore` loop completes faster
