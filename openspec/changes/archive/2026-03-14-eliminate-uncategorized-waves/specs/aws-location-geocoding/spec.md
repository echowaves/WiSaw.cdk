## ADDED Requirements

### Requirement: AWS Location Service reverse geocoding
The `reverseGeocode` function SHALL use AWS Location Service (`@aws-sdk/client-geo-places` `ReverseGeocodeCommand`) instead of Nominatim for reverse geocoding. The function SHALL accept lat/lon coordinates and return a human-readable location name.

#### Scenario: Successful geocoding of a city
- **WHEN** the anchor photo has lat=40.7128, lon=-74.0060
- **THEN** the function SHALL call AWS Location Service `ReverseGeocode` and return a location name from the response (e.g., `"New York"`)

#### Scenario: Successful geocoding of a rural area
- **WHEN** the anchor photo has coordinates in a rural area with no city
- **THEN** the function SHALL return the best available place name from the AWS response (municipality, region, or country)

### Requirement: Coordinate-based fallback name when geocoding fails
When AWS Location Service returns no results or throws an error for a photo anchor that has valid lat/lon coordinates, the system SHALL use a formatted coordinate string as the location name. The format SHALL be `"{lat}°{N|S}, {lon}°{E|W}"` with 1 decimal place.

#### Scenario: AWS geocoding returns no results
- **WHEN** the anchor photo has lat=40.7128, lon=-74.0060 and AWS Location Service returns empty results
- **THEN** the wave name SHALL be `"40.7°N, 74.0°W, {dateRange}"`

#### Scenario: AWS geocoding throws a network error
- **WHEN** the anchor photo has lat=-33.8688, lon=151.2093 and AWS Location Service throws an error
- **THEN** the wave name SHALL be `"33.9°S, 151.2°E, {dateRange}"`

### Requirement: Date-only name for all-locationless photos
When all photos in a batch lack GPS coordinates, the system SHALL name the wave using only the date range, without any prefix.

#### Scenario: All photos lack location data
- **WHEN** every photo in the batch has `null` lat and `null` lon
- **THEN** the wave name SHALL be the formatted date range only (e.g., `"Mar 2024"`)

### Requirement: No Uncategorized wave names
The auto-grouping function SHALL never produce a wave name containing the word "Uncategorized".

#### Scenario: Wave naming exhaustive check
- **WHEN** any combination of inputs is provided to the auto-grouping function
- **THEN** the resulting wave name SHALL NOT contain the substring "Uncategorized"

### Requirement: CDK IAM permissions for AWS Location Service
The CDK stack SHALL grant the main Lambda function (`wisawFn`) permission to call `geo-places:ReverseGeocode`.

#### Scenario: Lambda invokes ReverseGeocode
- **WHEN** the Lambda function calls `ReverseGeocodeCommand`
- **THEN** the IAM policy SHALL allow the `geo-places:ReverseGeocode` action

### Requirement: AWS SDK dependency pinned to exact version
The `@aws-sdk/client-geo-places` dependency SHALL be added to `package.json` with an exact version (no `^` or `~` prefix), matching the existing AWS SDK client version pattern.

#### Scenario: Dependency version check
- **WHEN** `@aws-sdk/client-geo-places` is added to `package.json`
- **THEN** the version SHALL be an exact version matching the other `@aws-sdk/client-*` packages (e.g., `"3.1003.0"`)
