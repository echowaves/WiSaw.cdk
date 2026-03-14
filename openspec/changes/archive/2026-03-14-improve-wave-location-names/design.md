## Context

The `reverseGeocode` function in `autoGroupPhotosIntoWaves.ts` uses AWS Location Service and currently returns the first non-null value from `Locality → District → SubRegion.Name → Region.Name → Country.Name`. This produces single-level names like "Tokyo" or "Springfield" without geographic context.

The AWS `Address` object provides structured fields including `Country.Code2` (ISO 2-letter code), `Region.Name` (state/province), and `Country.Name`.

## Goals / Non-Goals

**Goals:**
- Produce compound location names: `"City, State"` for US, `"City, Country"` for non-US
- Handle cases where city-level data is missing gracefully

**Non-Goals:**
- Changing wave grouping logic
- Handling multi-country waves
- Localizing country/state names (English only, as set by `Language: 'en'`)

## Decisions

### 1. Use Country.Code2 to detect US locations
Check `addr.Country?.Code2 === 'US'` to branch between US and non-US naming.

**Rationale**: ISO country codes are reliable and consistent. `Code2` is always uppercase.

### 2. Compound name construction
- **US**: `"{locality}, {region}"` → e.g., `"Springfield, Illinois"`
- **Non-US**: `"{locality}, {country}"` → e.g., `"Tokyo, Japan"`

Where `locality` is the best available local name: `Locality ?? District ?? SubRegion.Name`.

### 3. Fallback when locality is unavailable
If no city-level name exists:
- **US**: return `Region.Name` alone (e.g., `"Illinois"`)
- **Non-US**: return `Country.Name` alone (e.g., `"Japan"`)
- If neither exists: return `null` (coordinate fallback will handle it)

## Risks / Trade-offs

- [Some non-US regions use state-level naming like US] → Acceptable; country context is still useful internationally
- [Duplicate locality part if Locality equals Region/Country] → Unlikely with structured data from AWS
