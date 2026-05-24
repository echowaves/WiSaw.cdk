## ADDED Requirements

### Requirement: Season key computation

The system SHALL compute a season key from a photo's `createdAt` date using calendar-based seasons:

| Months | Season |
|--------|--------|
| Dec, Jan, Feb | WINTER |
| Mar, Apr, May | SPRING |
| Jun, Jul, Aug | SUMMER |
| Sep, Oct, Nov | FALL |

The season key format SHALL be `"YYYY-SEASON"` where YYYY is the year the season **starts**. December belongs to that calendar year's winter (e.g., Dec 2025 → `"2025-WINTER"`, Jan 2026 → `"2025-WINTER"`, Mar 2026 → `"2026-SPRING"`).

#### Scenario: Winter spanning year boundary

- **WHEN** a photo has `createdAt` of January 15, 2026
- **THEN** the season key is `"2025-WINTER"`

#### Scenario: December belongs to same-year winter

- **WHEN** a photo has `createdAt` of December 3, 2025
- **THEN** the season key is `"2025-WINTER"`

#### Scenario: Spring season key

- **WHEN** a photo has `createdAt` of April 10, 2026
- **THEN** the season key is `"2026-SPRING"`

#### Scenario: Summer season key

- **WHEN** a photo has `createdAt` of July 22, 2026
- **THEN** the season key is `"2026-SUMMER"`

#### Scenario: Fall season key

- **WHEN** a photo has `createdAt` of October 5, 2026
- **THEN** the season key is `"2026-FALL"`

### Requirement: Season-based wave closing

The system SHALL close the active wave and start a new one when a matching photo's season key differs from the active wave's season key.

#### Scenario: Photo crosses season boundary

- **GIVEN** an active wave with season key `"2025-WINTER"` containing photos from January 2026
- **WHEN** a matching photo with `createdAt` of March 5, 2026 is encountered
- **THEN** the active wave is closed
- **AND** a new wave is created with season key `"2026-SPRING"` starting from this photo

#### Scenario: Photos within same season stay grouped

- **GIVEN** an active wave with season key `"2025-WINTER"`
- **WHEN** matching photos from December 2025, January 2026, and February 2026 are encountered
- **THEN** all photos are added to the same wave

### Requirement: Wave photo count limit

Each wave SHALL contain a maximum of 1000 photos. When the limit is reached, the active wave SHALL be closed and a new wave SHALL be created for the same locality and season.

#### Scenario: Wave closes at 1000 photos

- **GIVEN** an active wave with 999 photos
- **WHEN** the 1000th matching photo is added
- **AND** the 1001st matching photo is encountered
- **THEN** the active wave is closed
- **AND** a new wave is created for the same locality and season

### Requirement: Season-based wave naming

Wave names SHALL use the format `"<LocalityName>, <Season> <Year>"` where Season is the capitalized season name and Year is the season-start year.

#### Scenario: City-level wave name with season

- **GIVEN** auto-grouping at `CITY` level with photos in "New York"
- **WHEN** a wave is created for winter photos
- **THEN** the wave name is `"New York, Winter 2025"`

#### Scenario: Country-level wave name with season

- **GIVEN** auto-grouping at `COUNTRY` level with photos in "United States"
- **WHEN** a wave is created for summer photos
- **THEN** the wave name is `"United States, Summer 2026"`

#### Scenario: Null-geo wave name with season

- **GIVEN** a photo with null locality fields but coordinates 40.7°N, 74.0°W
- **WHEN** a wave is created from this photo
- **THEN** the wave name is `"40.7°N, 74.0°W, Winter 2025"`
