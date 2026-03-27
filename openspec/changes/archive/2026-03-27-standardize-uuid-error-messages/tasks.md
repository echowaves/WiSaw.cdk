## 1. Shared Helper

- [x] 1.1 Create `lambda-fns/utilities/assertValidUuid.ts` with UUID regex validation that throws `Wrong UUID format for <fieldName>: "<value>"`

## 2. Photos Controllers

- [x] 2.1 Convert `lambda-fns/controllers/photos/delete.ts` to use `assertValidUuid`
- [x] 2.2 Convert `lambda-fns/controllers/photos/getPhotoAllCurr.ts` to use `assertValidUuid`
- [x] 2.3 Convert `lambda-fns/controllers/photos/getPhotoAllNext.ts` to use `assertValidUuid`
- [x] 2.4 Convert `lambda-fns/controllers/photos/getPhotoAllPrev.ts` to use `assertValidUuid`
- [x] 2.5 Convert `lambda-fns/controllers/photos/getPhotoDetails.ts` to use `assertValidUuid`
- [x] 2.6 Convert `lambda-fns/controllers/photos/watch.ts` to use `assertValidUuid`
- [x] 2.7 Convert `lambda-fns/controllers/photos/unwatch.ts` to use `assertValidUuid`
- [x] 2.8 Convert `lambda-fns/controllers/photos/feedForWatcher.ts` to use `assertValidUuid`
- [x] 2.9 Convert `lambda-fns/controllers/photos/feedForWave.ts` to use `assertValidUuid`

## 3. Waves Controllers

- [x] 3.1 Convert `lambda-fns/controllers/waves/addPhoto.ts` to use `assertValidUuid` (3 validations: waveUuid, photoId, uuid)
- [x] 3.2 Convert `lambda-fns/controllers/waves/removePhoto.ts` to use `assertValidUuid` (2 validations: waveUuid, photoId)
- [x] 3.3 Convert `lambda-fns/controllers/waves/create.ts` to use `assertValidUuid`
- [x] 3.4 Convert `lambda-fns/controllers/waves/delete.ts` to use `assertValidUuid` (2 validations: waveUuid, uuid)
- [x] 3.5 Convert `lambda-fns/controllers/waves/update.ts` to use `assertValidUuid` (2 validations: waveUuid, uuid)
- [x] 3.6 Convert `lambda-fns/controllers/waves/mergeWaves.ts` to use `assertValidUuid` (3 validations: targetWaveUuid, sourceWaveUuid, uuid)
- [x] 3.7 Convert `lambda-fns/controllers/waves/listWaves.ts` to use `assertValidUuid`
- [x] 3.8 Convert `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts` to use `assertValidUuid`
- [x] 3.9 Convert `lambda-fns/controllers/waves/getUngroupedPhotosCount.ts` to use `assertValidUuid`
- [x] 3.10 Convert `lambda-fns/controllers/waves/listPhotoLocations.ts` to use `assertValidUuid`

## 4. Messages Controllers

- [x] 4.1 Convert `lambda-fns/controllers/messages/send.ts` to use `assertValidUuid` (3 validations: chatUuid, uuid, messageUuid)
- [x] 4.2 Convert `lambda-fns/controllers/messages/getMessagesList.ts` to use `assertValidUuid`
- [x] 4.3 Convert `lambda-fns/controllers/messages/resetUnreadCount.ts` to use `assertValidUuid` (2 validations: chatUuid, uuid)

## 5. Friendships Controllers

- [x] 5.1 Convert `lambda-fns/controllers/friendships/createFriendship.ts` to use `assertValidUuid`
- [x] 5.2 Convert `lambda-fns/controllers/friendships/acceptFriendshipRequest.ts` to use `assertValidUuid` (split combined check into separate assertions)
- [x] 5.3 Convert `lambda-fns/controllers/friendships/delete.ts` to use `assertValidUuid`
- [x] 5.4 Convert `lambda-fns/controllers/friendships/getFriendshipsList.ts` to use `assertValidUuid`
- [x] 5.5 Convert `lambda-fns/controllers/friendships/getUnreadCountsList.ts` to use `assertValidUuid`

## 6. Other Controllers

- [x] 6.1 Convert `lambda-fns/controllers/abuseReports/create.ts` to use `assertValidUuid`
- [x] 6.2 Convert `lambda-fns/controllers/comments/create.ts` to use `assertValidUuid`
- [x] 6.3 Convert `lambda-fns/controllers/contactForms/create.ts` to use `assertValidUuid`
- [x] 6.4 Convert `lambda-fns/controllers/secrets/register.ts` to use `assertValidUuid`

## 7. Cleanup

- [x] 7.1 Delete `lambda-fns/utilities/isValidPhotoId.ts`
- [x] 7.2 Delete `lambda-fns/utilities/isValidDeviceUuid.ts`
