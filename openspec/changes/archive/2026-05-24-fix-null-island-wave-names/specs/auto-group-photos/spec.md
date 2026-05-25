## MODIFIED Requirements

### Requirement: Wave name uses locality from groupingLevel

Wave name follows `<LocalityName>, <Season> <Year>`. The locality at the selected groupingLevel is read from the database. If the relevant field is null, fallback to the photo's or wave's actual coordinates. If coordinates are also null, use "Unlocated".

- `DISTRICT` → uses `photo.district` from database
- `CITY` → uses `photo.locality` from database
- `REGION` → uses `photo.region` from database
- `COUNTRY` → uses `photo.country` from database

#### Scenario: Wave name uses actual coordinates when geo fields are null

- **GIVEN** a photo with null locality, district, region, and country, but coordinates 42.3°N / 71.1°W
- **WHEN** a wave is created from this photo
- **THEN** wave name is `"42.3°N, 71.1°W, Winter 2025"`
- **AND** wave name is NOT `"0.0°N, 0.0°E, Winter 2025"`

#### Scenario: Wave name uses "Unlocated" when both geo and coordinates are null

- **GIVEN** a photo with null locality, district, region, country, lat, and lon
- **WHEN** a wave is created from this photo
- **THEN** wave name is `"Unlocated, Winter 2025"`

#### Scenario: Refined wave name uses anchor coordinates when refinement geo is null

- **GIVEN** a wave with anchor coordinates 42.3°N / 71.1°W
- **WHEN** wave name refinement produces null from `computeWaveNameFromKey`
- **THEN** the refined name uses the anchor coordinates: `"42.3°N, 71.1°W, Winter 2025"`
