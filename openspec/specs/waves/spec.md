## ADDED Requirements

### Requirement: createWave enforces ownership bootstrap and date rules
`createWave` requires caller identity in `Secrets`, creates wave with `open=false`, inserts creator as `owner` in `WaveUsers`, and enforces `freezeDate > splashDate` when both are present.

### Requirement: updateWave is owner-only with frozen restrictions
`updateWave` is owner-only. On frozen waves, only `freezeDate` updates are allowed. Optional `null` and `undefined` inputs are treated as not provided; empty description string clears description.

### Requirement: listWaves returns paginated membership waves with computed fields
`listWaves` returns waves for caller membership including photos preview, persisted `photosCount`, computed `isFrozen`, `myRole`, and `joinUrl` behavior.

### Requirement: addPhotoToWave supports idempotent add and cross-wave move
`addPhotoToWave` enforces membership/ban/geo/frozen checks. If photo is already in target wave, call is idempotent. If photo is in another wave, it is auto-moved when allowed; move is blocked when source wave is frozen unless caller is source owner.

### Requirement: removePhotoFromWave is role-based
Owner may always remove. Facilitator and contributor permissions depend on unfrozen state and ownership rules. `photosCount` is updated after removal.

### Requirement: graph operations include auto-group and waves count
`autoGroupPhotosIntoWaves` and `getWavesCount` are exposed and follow current controller behavior and return shapes.