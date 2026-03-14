## 1. GraphQL Schema

- [ ] 1.1 Add `photos: [String]` field to the `Wave` type in `graphql/schema.graphql`

## 2. Wave Model

- [ ] 2.1 Add `photos: string[]` property to the `Wave` class in `lambda-fns/models/wave.ts`

## 3. Controller

- [ ] 3.1 Update `lambda-fns/controllers/waves/listWaves.ts` to batch-fetch photo IDs from `WavePhotos` + `Photos` for all waves on the page using `ANY($1)`
- [ ] 3.2 Construct thumbnail URLs (`https://${S3_IMAGES}/${id}-thumb.webp`) and attach `photos` array to each wave
