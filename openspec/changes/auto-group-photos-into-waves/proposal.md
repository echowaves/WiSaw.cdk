## Why

Users accumulate hundreds or thousands of photos over time but have no automatic way to organize them into waves. Currently, waves must be created and populated manually. An auto-grouping Lambda would analyze a user's ungrouped photos and cluster them by spatial proximity and temporal proximity, creating named waves that reflect where and when the photos were taken — making the entire photo history browsable and discoverable without manual effort.

## What Changes

- Add a new standalone Lambda function `autoGroupPhotosIntoWaves` that can be invoked per-user
- The Lambda queries all of a user's active photos not yet assigned to any wave
- Clusters photos using a hybrid spatial + temporal algorithm (PostGIS `ST_ClusterDBSCAN` for location, then sub-cluster by time gaps)
- Auto-creates a Wave for each cluster with a descriptive name derived from reverse geocoding the cluster centroid and the date range
- Inserts WavePhotos records to associate every ungrouped photo into exactly one wave
- Add a GraphQL mutation to trigger the auto-grouping for a specific user
- Add a CDK resource definition for the new Lambda with appropriate timeout/memory for batch processing

## Capabilities

### New Capabilities
- `auto-group-photos`: Lambda function that analyzes a user's ungrouped photos, clusters them by location and time, creates named waves, and assigns photos to waves

### Modified Capabilities
- `waves`: Add the `autoGroupPhotosIntoWaves` mutation and the new GraphQL type for the grouping result

## Impact

- New Lambda function at `lambda-fns/lambdas/autoGroupPhotosIntoWaves/`
- New controller at `lambda-fns/controllers/waves/autoGroup.ts`
- GraphQL schema updated with new mutation
- CDK stack updated with new Lambda resource and AppSync data source
- Relies on existing PostGIS clustering (`ST_ClusterDBSCAN`) pattern from `listPhotoLocations`
- Reverse geocoding requires an external API call (AWS Location Service or OpenStreetMap Nominatim) — new external dependency
- Potentially long-running for users with many photos — needs adequate Lambda timeout
