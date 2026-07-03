# spec: photo-feed

## MODIFIED Requirements

### Requirement: Photo objects include lastComment

The `Photo` model class SHALL declare `lastComment: string | null` so that `plainToClass(Photo, row)` copies the value from database rows to the resulting object instance.

#### Scenario: Photo model declares lastComment

- **WHEN** `plainToClass(Photo, row)` is called with a DB row containing `lastComment`
- **THEN** the resulting Photo instance HAS the `lastComment` property set to the row's value

#### Scenario: Photo.toJSON() includes lastComment

- **WHEN** `photo.toJSON()` is called on a Photo instance
- **THEN** the result includes `lastComment` with the value from the database row

#### Scenario: Wave card photos include lastComment

- **WHEN** `listWaves()` returns photos for wave cards
- **THEN** each Photo object includes a non-null `lastComment` field populated from the database

#### Scenario: Photo feed includes lastComment

- **WHEN** any photo feed query (`feedByDate`, `feedForWatcher`, `feedForWave`, `feedForFriend`) returns photos
- **THEN** each Photo object includes a `lastComment` field populated from the database
