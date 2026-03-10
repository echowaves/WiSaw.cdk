## 1. GraphQL Schema

- [x] 1.1 Add `AutoGroupResult` type to `graphql/schema.graphql` with fields `wavesCreated: Int!` and `photosGrouped: Int!`
- [x] 1.2 Add `autoGroupPhotosIntoWaves(uuid: String!): AutoGroupResult!` mutation to `graphql/schema.graphql`

## 2. Core Controller

- [x] 2.1 Create `lambda-fns/controllers/waves/autoGroup.ts` with the main `autoGroupPhotosIntoWaves(uuid)` function
- [x] 2.2 Implement spatial clustering query using `ST_ClusterDBSCAN` on ungrouped photos (LEFT JOIN WavePhotos IS NULL pattern from listPhotoLocations)
- [x] 2.3 Implement temporal sub-clustering logic — sort photos within each spatial cluster by `createdAt`, split on 30-day gaps
- [x] 2.4 Implement reverse geocoding helper using Nominatim API (`https://nominatim.openstreetmap.org/reverse?zoom=10&format=json`) with 1-second rate limiting and User-Agent header
- [x] 2.5 Implement wave name formatting (`"<Location>, <DateRange>"`) with single-day, single-month, multi-month, and cross-year patterns
- [x] 2.6 Implement geocoding failure fallback to coordinate-based names (e.g., `"40.7°N 74.0°W, Jun 2024"`)
- [x] 2.7 Implement wave creation and photo association — for each cluster: insert Wave, insert WaveUsers, bulk insert WavePhotos
- [x] 2.8 Return `AutoGroupResult` with `wavesCreated` and `photosGrouped` counts

## 3. AppSync Integration

- [x] 3.1 Register `autoGroupPhotosIntoWaves` in the mutation handlers in `lambda-fns/index.ts` following the existing resolver dispatch pattern
- [x] 3.2 Wire up the new mutation in the AppSync CDK resource (`lib/resources/resolvers.ts`) as a mutation mapping

## 4. CDK Lambda Configuration

- [x] 4.1 Configure the main AppSync Lambda with adequate timeout (300s) for auto-grouping, or verify the current timeout is sufficient
