## 1. GraphQL Schema

- [x] 1.1 Change `Wave.photos` from `[String]` to `[Photo]` in `graphql/schema.graphql`

## 2. Wave Model

- [x] 2.1 Update `photos` type in `lambda-fns/models/wave.ts` from `string[]` to `any[]`

## 3. Controller

- [x] 3.1 Update the photo subquery in `lambda-fns/controllers/waves/listWaves.ts` to select all `Photos` columns and alias `row_num` as `row_number`
- [x] 3.2 Replace the URL string builder with `plainToClass(Photo, row).toJSON()` transformation
- [x] 3.3 Import the `Photo` model in `listWaves.ts`

## 4. Verification

- [ ] 4.1 Deploy and verify `listWaves` returns Photo objects with `imgUrl`, `thumbUrl`, `videoUrl`, `width`, `height`, `video` fields
