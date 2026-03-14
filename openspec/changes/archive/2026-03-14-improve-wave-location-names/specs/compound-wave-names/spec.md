## ADDED Requirements

### Requirement: US locations use city and state
For locations in the United States (detected by `Country.Code2 === "US"`), the `reverseGeocode` function SHALL return a compound name in the format `"{city}, {state}"`.

#### Scenario: US city with state
- **WHEN** the address has `Locality = "Springfield"`, `Region.Name = "Illinois"`, `Country.Code2 = "US"`
- **THEN** the function SHALL return `"Springfield, Illinois"`

#### Scenario: US location with no city
- **WHEN** the address has no `Locality` or `District`, `Region.Name = "Montana"`, `Country.Code2 = "US"`
- **THEN** the function SHALL return `"Montana"`

### Requirement: Non-US locations use city and country
For locations outside the United States, the `reverseGeocode` function SHALL return a compound name in the format `"{city}, {country}"`.

#### Scenario: Non-US city with country
- **WHEN** the address has `Locality = "Tokyo"`, `Country.Name = "Japan"`, `Country.Code2 = "JP"`
- **THEN** the function SHALL return `"Tokyo, Japan"`

#### Scenario: Non-US location with no city
- **WHEN** the address has no `Locality` or `District` or `SubRegion`, `Country.Name = "Brazil"`, `Country.Code2 = "BR"`
- **THEN** the function SHALL return `"Brazil"`

### Requirement: Graceful fallback when address data is sparse
When the address lacks both city-level and region/country-level data, the function SHALL return `null`.

#### Scenario: Address with no usable fields
- **WHEN** the address has no `Locality`, no `District`, no `SubRegion`, no `Region`, and no `Country`
- **THEN** the function SHALL return `null`
