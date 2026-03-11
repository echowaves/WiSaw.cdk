## 1. Update GraphQL schema

- [x] 1.1 Add `photosRemaining: Int!` and `hasMore: Boolean!` fields to `AutoGroupResult` type in `graphql/schema.graphql`

## 2. Refactor autoGroupPhotosIntoWaves controller

- [x] 2.1 Update `AutoGroupResult` interface to include `photosRemaining` and `hasMore` fields
- [x] 2.2 Sort temporal clusters by `earliestDate` ascending and process only the first one (instead of looping through all)
- [x] 2.3 After creating the wave, query remaining ungrouped photo count and return `photosRemaining` and `hasMore`
- [x] 2.4 Update the zero-photos early return to include `photosRemaining: 0, hasMore: false`

## 3. Verify

- [x] 3.1 Run TypeScript compilation to confirm no syntax or type errors
