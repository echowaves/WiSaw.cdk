## Why

Wave names currently show only a single geographic level (e.g., just "Tokyo" or just "Illinois"). This lacks context — users can't tell what country "Springfield" is in, or what state "Portland" belongs to. Wave names should include two levels of geography for clarity: city + country for non-US locations, and city + state for US locations.

## What Changes

- Update `reverseGeocode` to return a compound location name with two geographic levels
- For US locations (detected via `Country.Code2 === "US"`): return `"{city}, {state}"` (e.g., `"Springfield, Illinois"`)
- For non-US locations: return `"{city}, {country}"` (e.g., `"Tokyo, Japan"`)
- Fall back gracefully when city-level data isn't available

## Capabilities

### New Capabilities
- `compound-wave-names`: Produce two-level geographic names for waves — city+state for US, city+country for non-US

### Modified Capabilities

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`: Modify `reverseGeocode` return value logic
- No API changes, no schema changes, no CDK changes, no new dependencies
