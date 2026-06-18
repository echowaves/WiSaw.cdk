## Context

**Current State:**
The `buildSearchClause()` utility function generates SQL WHERE clause fragments for full-text search across Photos, Recognitions, and Comments tables. It accepts two parameters:
- `searchTerm: string | null | undefined` - The search query text
- `paramStartIndex: number` - The PostgreSQL parameter index to start numbering from

The function returns a clause and params array where the search term is used as a `plainto_tsquery` parameter at position `$${paramStartIndex}`.

**Affected Queries:**
All affected controllers use `fetchPaginatedPhotos()` which executes queries with this parameter structure:
- `$1` = `limit` (integer)
- `$2` = `offset` (integer)
- `$3` onwards = additional parameters including search terms

**The Bug:**
When `buildSearchClause(searchTerm, 2)` is called, the generated SQL contains `$2` for the search term, but `$2` is already bound to the `offset` value in the main query. This causes:
1. Search functionality to fail or return incorrect results
2. Potential SQL errors due to parameter conflicts

**Files Already Correct:**
- `feedForWatcher.ts` - Uses `paramStartIndex=3` correctly
- `feedForWave.ts` - Uses `paramStartIndex=3` correctly  
- `feedByDate.ts` - Uses `paramStartIndex=6` (different query with more params)

## Goals / Non-Goals

**Goals:**
1. Fix parameter index mismatch in 4 controller files
2. Ensure search functionality works correctly across all affected feeds
3. Prevent future occurrences by documenting the parameter pattern

**Non-Goals:**
1. Changing the `buildSearchClause()` API or behavior
2. Modifying query structures or pagination logic
3. Adding new tests (assumes existing test suite covers functionality)

## Decisions

**Decision: Direct Fix Over Refactoring**
- **Why**: This is a straightforward parameter index mismatch, not a design flaw
- **Alternative Considered**: Wrapping `buildSearchClause()` to infer the correct index automatically
- **Rejection Reason**: Would add unnecessary abstraction; current API is clear if used correctly

**Decision: Change 2 → 3 in All 4 Files**
- **Why**: All affected queries follow the same pattern: `$1=limit`, `$2=offset`, `$3=searchTerm`
- **Alternative Considered**: Different indices per file based on their specific queries
- **Rejection Reason**: The pattern is consistent; all need `$3` for search term

**Decision: No API Changes**
- **Why**: The function signature is correct; callers just used wrong values
- **Alternative Considered**: Rename or re-order parameters for clarity
- **Rejection Reason**: Would be a breaking change with no benefit; the bug is in caller usage

## Risks / Trade-offs

**Risk: Existing Tests May Not Catch This**
- [Test file] may not have search term tests, or tests used mock data that didn't expose the issue
- **Mitigation**: Run existing tests after fix to ensure no regressions

**Risk: Silent Data Corruption**
- [Before Fix] The query may have returned results based on offset value being used as search term
- **Mitigation**: Consider audit of any data that may have been incorrectly returned

**Risk: Developer Confusion**
- Future developers may not understand why `paramStartIndex=3` is used
- **Mitigation**: Add inline comment explaining parameter pattern in `buildSearchClause()` or in affected files

## Migration Plan

**Deployment:**
1. Deploy updated Lambda functions (no database migration needed)
2. Monitor CloudWatch logs for any query errors
3. Verify search functionality in affected feeds works correctly

**Rollback Strategy:**
- If issues detected, revert the 4 file changes
- No database changes to rollback

**Open Questions:**
1. Should we add a test case that specifically validates search term binding?
2. Should we add documentation in `buildSearchClause()` about common parameter patterns?
