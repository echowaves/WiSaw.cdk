## ADDED Requirements

### Requirement: Structured address field extraction from AWS geocoding
The `reverseGeocode` function SHALL extract the location name from the structured `Address` fields of the AWS Location Service response, using the fallback chain: `Locality → District → SubRegion.Name → Region.Name → Country.Name`. It SHALL return the first non-null value.

#### Scenario: City-level geocoding in Japan
- **WHEN** the anchor coordinates point to Tokyo, Japan
- **THEN** the function SHALL return a geographic locality name (e.g., `"Minato"` or `"Tokyo"`) and NOT a POI name like `"Embassy of the Syrian Arab Republic"`

#### Scenario: Rural area with no city
- **WHEN** the anchor coordinates point to a rural area with no Locality or District
- **THEN** the function SHALL fall back to `SubRegion.Name`, then `Region.Name`, then `Country.Name`

### Requirement: Skip out-of-range photos instead of breaking
The walk loop SHALL skip photos that are beyond the distance threshold instead of stopping. Out-of-range photos SHALL remain ungrouped for processing in a future invocation.

#### Scenario: Outlier photo between in-range photos
- **WHEN** photos 1-50 are in Tokyo, photo 51 is in Osaka (>100km), and photos 52-100 are in Tokyo
- **THEN** photos 1-50 and 52-100 SHALL be collected into one wave, and photo 51 SHALL remain ungrouped

#### Scenario: GPS glitch photo
- **WHEN** a single photo has a GPS location far from the anchor due to a glitch
- **THEN** that photo SHALL be skipped and the remaining in-range photos SHALL still be collected

### Requirement: Title field not used for wave naming
The `reverseGeocode` function SHALL NOT use the `Title` field from `ReverseGeocodeCommand` response, as it contains POI names rather than geographic locality names.

#### Scenario: Response with Title containing POI name
- **WHEN** the AWS response has `Title = "Embassy of the Syrian Arab Republic"` and `Address.Locality = "Minato"`
- **THEN** the function SHALL return `"Minato"` and NOT `"Embassy of the Syrian Arab Republic"`
