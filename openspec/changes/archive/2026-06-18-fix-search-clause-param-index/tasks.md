## 1. Fix Parameter Index in Controller Files

- [x] 1.1 Update `lambda-fns/controllers/photos/feedForTextSearch.ts` line 17: change `buildSearchClause(searchTerm, 2)` to `buildSearchClause(searchTerm, 3)`
- [x] 1.2 Update `lambda-fns/controllers/photos/feedRecent.ts` line 17: change `buildSearchClause(searchTerm, 2)` to `buildSearchClause(searchTerm, 3)`
- [x] 1.3 Update `lambda-fns/controllers/photos/feedForUngrouped.ts` line 21: change `buildSearchClause(searchTerm, 2)` to `buildSearchClause(searchTerm, 3)`
- [x] 1.4 Update `lambda-fns/controllers/friendships/feedForFriend.ts` line 67: change `buildSearchClause(searchTerm, 2)` to `buildSearchClause(searchTerm, 3)`

## 2. Verification

- [x] 2.1 Run existing test suite to ensure no regressions
- [x] 2.2 Verify search functionality works correctly in affected feeds
- [x] 2.3 Check CloudWatch logs for any SQL query errors after deployment
