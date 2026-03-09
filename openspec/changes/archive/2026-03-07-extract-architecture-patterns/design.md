## Context

WiSaw is a geo-located photo sharing platform built on AWS CDK with AppSync (GraphQL), PostgreSQL + PostGIS, and AWS Lambda. The codebase has 16 feature-level specs covering individual capabilities (photo-feed, comments, waves, etc.), but no documentation of the underlying architectural patterns that all features share. Developers and AI assistants must reverse-engineer these patterns from source code when building new features, leading to inconsistency.

## Goals / Non-Goals

**Goals:**
- Document the five cross-cutting architecture patterns identified in the proposal: GraphQL resolver dispatch, controller conventions, database access patterns, CDK infrastructure, and data model conventions
- Each spec captures the existing patterns as-is (descriptive, not prescriptive changes)
- Specs serve as guardrails for AI-assisted code generation and new feature development

**Non-Goals:**
- Changing any existing code or architecture
- Proposing new patterns or refactoring existing ones
- Documenting individual feature behavior (covered by existing 16 specs)
- Creating runnable tests from the specs (future work)

## Decisions

### Single set of architecture specs rather than inline documentation
**Rationale:** Centralizing patterns in openspec specs makes them machine-readable, versionable, and discoverable by AI tools. Inline code comments would scatter the documentation and not be queryable as a coherent reference.
**Alternative considered:** Adding JSDoc/TSDoc to source files — rejected because it fragments the architectural narrative and doesn't capture cross-file patterns.

### Five capability specs matching the natural architectural layers
**Rationale:** The codebase has five distinct layers: (1) GraphQL dispatch routing, (2) controller functions, (3) database access, (4) CDK infrastructure, (5) data models. Each layer has its own conventions that are independent enough to warrant separate specs.
**Alternative considered:** A single monolithic architecture spec — rejected because it would be too large and mix unrelated concerns.

### Descriptive specs capturing existing patterns, not prescribing changes
**Rationale:** The goal is documentation fidelity. Prescriptive specs would blur the line between "what is" and "what should be," creating confusion about whether the code needs to change.

## Risks / Trade-offs

- [Specs may drift from code] → Mitigated by spec sync during archive; specs should be updated when architecture changes
- [Five new specs increases maintenance surface] → Acceptable trade-off; architecture changes infrequently and the specs prevent costly reverse-engineering
- [Specs may be too detailed or too abstract] → Use concrete code examples and scenario-based format to stay grounded in actual implementation
