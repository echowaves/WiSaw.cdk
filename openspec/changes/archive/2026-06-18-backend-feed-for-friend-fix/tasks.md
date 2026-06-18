## 1. Implementation

- [x] 1.1 Update SQL query in `lambda-fns/controllers/friendships/feedForFriend.ts` to JOIN with Watchers table
- [x] 1.2 Verify parameter binding remains correct after JOIN change
- [ ] 1.3 Run backend tests to ensure no regressions
- [ ] 1.4 Test locally with a friend who has shared photos

## 2. Verification

- [ ] 2.1 Deploy to test environment
- [ ] 2.2 Click photo in friend card - verifies navigation to friend feed
- [ ] 2.3 Friend feed shows actual photos (not "No Photos Yet")
- [ ] 2.4 Scroll friend feed - loads more photos correctly
- [ ] 2.5 Friend with no photos shows correct empty state

## 3. Deployment

- [ ] 3.1 Create PR with changes
- [ ] 3.2 Get code review
- [ ] 3.3 Merge to main
- [ ] 3.4 Monitor error logs for any issues
