## ADDED Requirements

### Requirement: Models are plain TypeScript classes without ORM decorators
Data models SHALL be defined as plain TypeScript classes with typed properties matching database column names. Models SHALL NOT use ORM decorators (e.g., Sequelize, TypeORM). The class serves as a type definition and optional serialization hook.

#### Scenario: Photo model definition
- **WHEN** the Photo model class is defined
- **THEN** it SHALL have typed properties (`id: string`, `uuid: string`, `location: object`, `commentsCount: bigint`, etc.) with no decorators or ORM metadata

#### Scenario: Wave model definition
- **WHEN** the Wave model class is defined
- **THEN** it SHALL be a plain class exported as a named or default export with properties matching the database columns

### Requirement: Models use class-transformer for instantiation
Database row objects SHALL be converted to model instances using `plainToClass(ModelClass, dbRow)` from the `class-transformer` library. This enables custom serialization behavior defined in the model's `toJSON()` method.

#### Scenario: Converting a database row to a model
- **WHEN** a controller retrieves a row from the database
- **THEN** it SHALL convert the raw row object to a model instance via `plainToClass(Photo, row)`

### Requirement: Derived properties are computed in toJSON
Models that need derived properties (e.g., URLs constructed from environment variables and record IDs) SHALL implement a `toJSON()` method that spreads `...this` and adds computed properties. This method is automatically invoked during JSON serialization by AppSync.

#### Scenario: Photo model derives image URLs
- **WHEN** a Photo instance is serialized to JSON
- **THEN** `toJSON()` SHALL return `{ ...this, imgUrl, thumbUrl, videoUrl }` where URLs are constructed from `process.env.S3_IMAGES` and the photo's `id`

#### Scenario: Model without derived properties
- **WHEN** a model has no computed properties (e.g., Wave, Message)
- **THEN** it SHALL NOT implement `toJSON()` and rely on default serialization

### Requirement: Models support UUID and integer ID duality
Models that originated before the UUID migration SHALL have both an `id` field (UUID string, current primary key) and may reference legacy integer IDs in relationships. New models SHALL use UUID as the primary identifier.

#### Scenario: Photo model ID fields
- **WHEN** the Photo model is defined
- **THEN** it SHALL have `id: string` (UUID) as the primary identifier

### Requirement: Timestamp fields use string type
All model timestamp fields (`createdAt`, `updatedAt`) SHALL be typed as `string` rather than `Date`. Timestamps are stored as formatted strings (`YYYY-MM-DD HH:mm:ss.SSS`) and passed through as strings in GraphQL responses.

#### Scenario: Model timestamp typing
- **WHEN** a model class defines timestamp fields
- **THEN** `createdAt` and `updatedAt` SHALL be typed as `string`

### Requirement: Models are located in lambda-fns/models directory
Each model class SHALL reside in its own file under `lambda-fns/models/`, named after the entity in camelCase (e.g., `photo.ts`, `wave.ts`, `message.ts`, `abuseReport.ts`).

#### Scenario: Adding a new model
- **WHEN** a new entity type is introduced
- **THEN** its model class SHALL be created at `lambda-fns/models/<entityName>.ts`

### Requirement: S3 asset URLs follow a consistent pattern
S3 URLs for photo assets SHALL be constructed as `https://${process.env.S3_IMAGES}/${id}.webp` for full images, `https://${process.env.S3_IMAGES}/${id}-thumb.webp` for thumbnails, and `https://${process.env.S3_IMAGES}/${id}.mov` for videos. The `S3_IMAGES` environment variable contains the CloudFront distribution domain.

#### Scenario: Image URL construction
- **WHEN** a Photo model serializes to JSON
- **THEN** `imgUrl` SHALL be `https://${S3_IMAGES}/${this.id}.webp` and `thumbUrl` SHALL be `https://${S3_IMAGES}/${this.id}-thumb.webp`

### Requirement: Export style matches usage context
Models imported by controllers using `import ModelName from ...` SHALL use default exports. Models imported using `import { ModelName } from ...` SHALL use named exports. Either style is acceptable but SHALL be consistent within each model file.

#### Scenario: Default export model
- **WHEN** a model is used as `import Photo from '../../models/photo'`
- **THEN** the model file SHALL use `export default Photo`

#### Scenario: Named export model
- **WHEN** a model is used as `import { Wave } from '../../models/wave'`
- **THEN** the model file SHALL use `export class Wave { ... }` or `export { Wave }`
