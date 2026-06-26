# Proposal: Server-Side Auto-Grouping with Subscription Notification

## Why

Currently, the `autoGroupPhotosIntoWaves` GraphQL mutation requires **clients to explicitly call** the mutation and loop while `hasMore === true` to group all ungrouped photos. This creates a poor user experience:

1. **Manual invocation required**: Clients must detect when grouping is needed and trigger it
2. **Client-side batching**: Clients must loop through batches until complete
3. **No real-time notification**: Clients don't know when auto-grouping completes
4. **Historical photos ignored**: Users with existing ungrouped photos never get them grouped unless they manually trigger it

**User Impact:**
- New photos remain ungrouped until user manually triggers grouping
- No indication when grouping completes
- Poor UX on first upload (historical photos not grouped)

## What Changes

Make auto-grouping **server-initiated** as part of photo upload processing:

1. **Auto-group after EVERY upload**: Trigger server-side in the S3 event handler
2. **Remove client responsibility**: No need for clients to call `autoGroupPhotosIntoWaves`
3. **Add subscription**: Notify clients when upload + auto-grouping completes
4. **Batch historical processing**: First upload processes ALL ungrouped photos
5. **Backward compatible**: Keep existing mutation for manual re-grouping

## Capabilities

### New Capabilities

**1. Server-Initiated Auto-Grouping**
- **Trigger**: S3 event handler (`processUploadedImage` Lambda)
- **Timing**: After photo activation (last step of upload processing)
- **Grouping Level**: Hardcoded to `CITY` (50km - "medium")
- **No Parameters**: Clients don't configure grouping level

**2. Real-Time Subscription Notification**
- **Subscription**: `onPhotoUploadComplete(photoId: String!): PhotoUploadResult`
- **Trigger**: When S3 processing completes (includes auto-grouping)
- **Payload**: `PhotoUploadResult { photoId, waveUuid?, name?, photosGrouped }`

**3. Historical Photo Processing**
- **Detection**: Check if user has ANY ungrouped photos
- **First Upload**: Process ALL historical ungrouped photos in batches
- **Subsequent Uploads**: Process just the new photo

### Modified Behavior

**Current (Client-Initiated):**
```
Client → Upload photo → Client must call autoGroupPhotosIntoWaves
Client → Loop while hasMore === true
Client → Refresh UI manually
```

**New (Server-Initiated):**
```
Client → Upload photo
S3 → processUploadedImage Lambda (auto-groups photos)
S3 → Publish onPhotoUploadComplete subscription
Client → Auto-receive notification, refresh UI
```

## Impact

**Affected Files:**

1. **GraphQL Schema**: `graphql/schema.graphql`
   - Add `PhotoUploadResult` type
   - Add `onPhotoUploadComplete` subscription

2. **Lambda Handler**: `lambda-fns/lambdas/processUploadedImage/index.ts`
   - Add `_triggerAutoGrouping` helper
   - Call auto-grouping after photo activation
   - Publish subscription notification

3. **Lambda Dispatcher**: `lambda-fns/index.ts`
   - Add `_notifyPhotoUploadComplete` mutation handler
   - Wire up subscription trigger

4. **CDK Resolvers**: `lib/resources/resolvers.ts`
   - Add `onPhotoUploadComplete` resolver mapping
   - Add `_notifyPhotoUploadComplete` mutation resolver

5. **Auto-Group Controller**: `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`
   - No changes needed (already accepts `uuid` and `groupingLevel`)
   - Will be called with `groupingLevel: 'CITY'`

## Context

**Current Upload Flow:**
```
S3 Event → processUploadedImage
  ├─ Generate WebP thumbnail
  ├─ Generate full-size WebP
  ├─ Run Rekognition
  ├─ Extract dimensions
  ├─ Delete upload temp file
  ├─ Activate photo (active=true)
  └─ DONE (no auto-grouping)
```

**New Upload Flow:**
```
S3 Event → processUploadedImage
  ├─ Generate WebP thumbnail
  ├─ Generate full-size WebP
  ├─ Run Rekognition
  ├─ Extract dimensions
  ├─ Delete upload temp file
  ├─ Activate photo (active=true)
  ├─ Check if user has ungrouped photos
  ├─ If YES: Call autoGroupPhotosIntoWaves(uuid, 'CITY')
  │   └─ Process all ungrouped photos in batches
  │       └─ Create waves, add photos, update counts
  └─ Fire-and-forget: Publish onPhotoUploadComplete subscription
      └─ Client receives notification, refreshes UI
```

**Auto-Grouping Logic (Existing, unchanged):**
```
autoGroupPhotosIntoWaves(uuid, groupingLevel)
  ├─ Fetch BATCH_LIMIT (1000) ungrouped photos ordered by createdAt ASC
  ├─ For each photo:
  │   ├─ Check if matches current wave (string + distance)
  │   ├─ If YES: Add to pending batch
  │   └─ If NO: Flush batch, create new wave
  ├─ Return { photosGrouped, photosRemaining, hasMore, waveUuid?, name? }
  └─ Client loops while hasMore === true
```

## Status

✅ **IMPLEMENTATION COMPLETE**

All tasks completed:

- [x] Task 1.1: Add `PhotoUploadResult` type to schema
- [x] Task 1.2: Add `onPhotoUploadComplete` subscription
- [x] Task 2.1: Create `_notifyPhotoUploadComplete` controller
- [x] Task 3.1: Update `processUploadedImage` Lambda
- [x] Task 3.2: Implement `_triggerAutoGrouping` helper
- [x] Task 4.1: Update Lambda dispatcher
- [x] Task 5.1: Update CDK resolvers

**Files Modified:**
- `graphql/schema.graphql` - New types and subscription
- `lambda-fns/index.ts` - Mutation handler
- `lambda-fns/lambdas/processUploadedImage/index.ts` - Lambda helpers
- `lambda-fns/controllers/photos/_notifyPhotoUploadComplete.ts` - NEW
- `lib/resources/resolvers.ts` - Resolver mapping

**Modified Auto-Grouping (Server-Initiated):**
```
_triggerAutoGrouping(photoId)
  ├─ Query photo's uuid (device UUID)
  ├─ Query ungrouped photos count for this uuid
  ├─ If count === 0: Skip (nothing to group)
  ├─ If count > 0: Call autoGroupPhotosIntoWaves(uuid, 'CITY')
  │   └─ Process ALL ungrouped photos (batch by batch)
  └─ When photosRemaining === 0: Publish subscription
```

## Goals / Non-Goals

**Goals:**
- Auto-group after EVERY photo upload (server-side)
- Handle historical ungrouped photos on first upload
- Add subscription for real-time client notification
- Keep backward compatibility with existing mutation
- No configuration parameters (always use CITY level)
- Async batch processing to avoid Lambda timeout

**Non-Goals:**
- Not changing auto-grouping algorithm
- Not removing client-initiated mutation (backward compatibility)
- Not adding configuration UI for grouping level
- Not changing grouping algorithm or thresholds

## Decisions

**1. Server-Initiated Trigger Location**
- **Decision**: `processUploadedImage` Lambda, after `_activatePhoto`
- **Rationale**: S3 trigger is the single source of truth for photo uploads
- **Alternative Considered**: EventBridge rule after Lambda completes
- **Rejected Because**: More complex, additional infrastructure

**2. Grouping Level Hardcoded to CITY**
- **Decision**: `groupingLevel: 'CITY'` (50km) in server invocation
- **Rationale**: User requirement - no configuration parameters
- **Backward Compatibility**: Client mutation can still pass any groupingLevel

**3. Async Batch Processing**
- **Decision**: Use async/await, don't await full batch completion
- **Rationale**: Avoid Lambda timeout on large batch (1000 photos × N batches)
- **Trade-off**: Subscription publishes when last batch starts, not when complete

**4. Subscription Trigger Timing**
- **Decision**: Publish when S3 processing completes (includes auto-grouping)
- **Rationale**: Client knows upload + grouping is complete, can refresh UI
- **Alternative Considered**: Publish immediately after photo activation
- **Rejected Because**: Auto-grouping might still be running

**5. Silent Auto-Grouping**
- **Decision**: Auto-grouping returns void (not awaited in Promise.all)
- **Rationale**: Photo upload should succeed even if auto-grouping fails
- **Error Handling**: Log errors but don't rollback

**6. First Upload Detection**
- **Decision**: Check `getUngroupedPhotosCount(uuid) > 0`
- **Rationale**: Simple, existing controller available
- **Alternative Considered**: Check photo count threshold (e.g., > 10)
- **Rejected Because**: Less accurate, arbitrary threshold

## Risks / Trade-offs

**Risk 1: Lambda Timeout on Large Batch**
- **Description**: First upload with 10,000+ historical photos might exceed Lambda timeout
- **Mitigation**: Async processing, batch of 1000 at a time, timeout=300s should handle it
- **Fallback**: If timeout occurs, remaining photos will be grouped on next upload

**Risk 2: Subscription Publish Timing**
- **Description**: Subscription might publish before auto-grouping completes
- **Mitigation**: Accept this trade-off for async processing, client might see partial results
- **Alternative Considered**: Wait for all batches to complete (blocks Lambda)
- **Rejected Because**: Lambda timeout risk on large batches

**Risk 3: Duplicate Wave Creation**
- **Description**: Rapid uploads might cause race condition in wave creation
- **Mitigation**: PostgreSQL advisory lock already in place (`hashtext('autoGroup:' || $1)`)
- **Existing Protection**: Lock prevents concurrent auto-grouping for same uuid

**Risk 4: Backward Compatibility Break**
- **Description**: Existing clients relying on mutation might break
- **Mitigation**: Keep mutation unchanged, just add server-side trigger
- **Grace Period**: Clients can migrate at their own pace

## Tasks

See `tasks.md` for detailed implementation tasks.
