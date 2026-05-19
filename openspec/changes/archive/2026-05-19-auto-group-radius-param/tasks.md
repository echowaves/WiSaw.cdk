## 1. GraphQL Schema

- [x] 1.1 Add optional `radius: Int` parameter to `autoGroupPhotosIntoWaves` mutation in `graphql/schema.graphql`

## 2. Resolver Wiring

- [x] 2.1 Update `getArgs` in `lambda-fns/index.ts` to pass `args.radius` to the controller

## 3. Controller

- [x] 3.1 Remove `DISTANCE_THRESHOLD_KM` constant, update `main` function signature to accept optional `radius?: number` parameter
- [x] 3.2 Replace `DISTANCE_THRESHOLD_KM` usage with `(radius ?? 100)`, rename `computeClusterRadius` result to `waveRadius` to avoid collision
