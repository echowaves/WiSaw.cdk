## 1. Modify addPhotoToWave Controller

- [x] 1.1 In `lambda-fns/controllers/waves/addPhoto.ts`, replace the "Photo is already in a wave" error block: when the photo is in a different wave, DELETE the `WavePhotos` row for the old wave and call `_updatePhotosCount` on the old `waveUuid`, then proceed with the INSERT into the target wave
