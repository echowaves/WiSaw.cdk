## ADDED Requirements

### Requirement: Migration naming uses timestamped action format
Files use `YYYYMMDDHHmmss-action-description.js` naming with action verbs like create/add/populate/remove.

### Requirement: Migrations use async/await with explicit down behavior
Migrations are written with async/await and provide `down()` reversals where feasible. Irreversible data operations may throw with clear reason.

### Requirement: Naming conventions follow project schema
Tables are PascalCase plural, columns are camelCase.

### Requirement: Constraint naming follows existing repository practice
Repository includes explicit primary constraints in `*_pkey` style on some tables; new migrations should remain consistent with surrounding table conventions.

### Requirement: queryInterface is preferred for standard DDL
Use queryInterface helpers for common DDL. Raw SQL is used when required for PostGIS/index/data transformation operations.
