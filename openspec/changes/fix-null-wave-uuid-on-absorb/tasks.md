## 1. Update assignPhotosToNearestWave return value

- [ ] 1.1 Change `assignPhotosToNearestWave` to return `{ assigned: number, primaryWaveUuid: string }` — track which wave received the most photo assignments
- [ ] 1.2 After assignment, query the primary wave's name from the `Waves` table and include it in the return

## 2. Update callers to use primary wave identity

- [ ] 2.1 In the main function geocoding-failure absorb path, return `waveUuid` and `name` from the `assignPhotosToNearestWave` result instead of null
- [ ] 2.2 In `handleUnresolvablePhotos` absorb path, return `waveUuid` and `name` from the `assignPhotosToNearestWave` result instead of null

## 3. Verification

- [ ] 3.1 Verify absorb results always return non-null `waveUuid` when `photosGrouped > 0`
- [ ] 3.2 Verify the returned `waveUuid` is the wave that received the most photos
