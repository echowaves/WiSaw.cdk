## 1. GraphQL Schema

- [ ] 1.1 Add `AutoGroupResult` type to `graphql/schema.graphql` with fields `wavesCreated: Int!` and `photosGrouped: Int!`
- [ ] 1.2 Add `autoGroupPhotosIntoWaves(uuid: String!): AutoGroupResult!` mutation to `graphql/schema.graphql`

## 2. Core Controller

- [ ] 2.1 Create `lambda-fns/controllers/waves/autoGroup.ts` with the main `autoGroupPhotosIntoWaves(uuid)` function
- [ ] 2.2 Implement spatial clustering query using `ST_ClusterDBSCAN` on ungrouped photos (LEFT JOIN WavePhotos IS NULL pattern from listPhotoLocations)
- [ ] 2.3 Implement temporal sub-clustering logic — sort photos within each spatial cluster by `createdAt`, split on 30-day gaps
- [ ] 2.4 Implement reverse geocoding helper using Nominatim API (`https://nominatim.openstreetmap.org/reverse?zoom=10&format=json`) with 1-second rate limiting and User-Agent header
- [ ] 2.5 Implement wave name formatting (`"<Location>, <DateRange>"`) with single-day, single-month, multi-month, and cross-year patterns
- [ ] 2.6 Implement geocoding failure fallback to coordinate-based names (e.g., `"40.7°N 74.0°W, Jun 2024"`)
- [ ] 2.7 Implement wave creation and photo association — for each cluster: insert Wave, insert WaveUsers, bulk insert WavePhotos
- [ ] 2.8 Return `AutoGroupResult` with `wavesCreated` and `photosGrouped` counts

## 3. AppSync Integration

- [ ] 3.1 Register `autoGroupPhotosIntoWaves` in the mutation handlers in `lambda-fns/index.ts` following the existing resolver dispatch pattern
- [ ] 3.2 Wire up the new mutation in the AppSync CDK resource (`lib/resources/app-sync.ts`) as a mutation mapping

## 4. CDK Lambda Configuration

- [ ] 4.1 Configure the main AppSync Lambda with adequate timeout (120s) for auto-grouping, or verify the current timeout is sufficient
