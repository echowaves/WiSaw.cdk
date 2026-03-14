## Why

Two bugs in auto-group photos into waves:

1. **Wrong location names**: AWS Location Service `ReverseGeocodeCommand` returns a `Title` field that contains the nearest POI name (point of interest — businesses, embassies, restaurants), not a geographic locality. This causes Japan to be labelled "Syria" when the nearest POI happens to be a Syrian embassy. The structured `Address` fields (`Locality`, `Region`, `Country`) should be used instead.

2. **Too many fragmented waves**: The walk algorithm breaks at the first photo beyond 100km of the anchor, even if subsequent photos are back in range. A single outlier photo (airport layover, GPS glitch) splits the entire batch, creating many small waves for what should be one contiguous wave.

## What Changes

- Replace `item.Title` with structured address field extraction (`Locality → District → SubRegion → Region → Country`) in `reverseGeocode`
- Change the distance walk from "break on first out-of-range" to "skip out-of-range, collecting all in-range photos" so outliers don't fragment waves

## Capabilities

### New Capabilities
- `fix-geocode-and-walk`: Fix reverse geocoding to use structured address fields and change walk to skip out-of-range photos instead of breaking

### Modified Capabilities

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`: Two changes — `reverseGeocode` response parsing and walk loop logic
- No API changes, no schema changes, no CDK changes, no new dependencies
