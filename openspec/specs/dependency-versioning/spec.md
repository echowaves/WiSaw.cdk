## ADDED Requirements

### Requirement: All npm dependencies pinned to exact versions
The project SHALL use exact version specifiers for all entries in `package.json` (both `dependencies` and `devDependencies`). Range prefixes (`^`, `~`) are not permitted.

#### Scenario: New dependency added
- **WHEN** any dependency is added to `package.json`
- **THEN** its version value SHALL be an exact version string (e.g. `"4.18.2"`) with no `^` or `~` prefix

#### Scenario: Existing dependency updated
- **WHEN** any dependency version is changed in `package.json`
- **THEN** the new version value SHALL be an exact version string with no range prefix
