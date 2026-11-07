# Deferred work — seo-indexing

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: Confirm `CLOUD_FRONT_DISTRIBUTION='E275CUZVESLWC7'` in `.env.prod` is the img.wisaw.com distribution (compare with the stack's `ImgCloudFrontDistributionId` CfnOutput) before enabling PHOTO_DELETE_CLEANUP in prod.
  evidence: Review pass 1 triage #3 — invalidation aimed at the wrong distribution reports success while deleted media keeps serving; frozen Decision routes this to the pre-enablement human check.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: Run `npm run cleanup-s3:dry-run` against prod inventory to settle whether legacy key shapes (extension-less, pre-rename layout) still exist for deleted photos and add them to the delete set if so.
  evidence: Review pass 1 triage #10 — `_deleteUpload` deletes an extension-less key, and `migrations/20250719120000-rename-s3-objects.js` implies a historical layout; AC1's "bucket listing shows none" is only proven for the four modern shapes. The dry-run report classifies such keys and settles it.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: At each environment's deploy, verify its gitignored `.env.<env>` actually sets PHOTO_DELETE_CLEANUP as intended (test: true; prod: off until the human gate passes).
  evidence: Review pass 1 triage #1 / pass 2 row 12 (carried) — env files are untracked by repo convention, so enablement cannot be guaranteed from version control; a forgotten flag silently runs cleanup OFF.
