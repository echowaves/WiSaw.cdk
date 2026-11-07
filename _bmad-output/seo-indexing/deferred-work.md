# Deferred work — seo-indexing

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: Confirm `CLOUD_FRONT_DISTRIBUTION='E275CUZVESLWC7'` in `.env.prod` is the img.wisaw.com distribution (compare with the stack's `ImgCloudFrontDistributionId` CfnOutput) before shipping this to prod — cleanup is unconditional, so a wrong id means invalidations land on the wrong distribution while deleted media keeps serving.
  evidence: Review pass 1 triage #3 — invalidation aimed at the wrong distribution reports success while deleted media keeps serving; frozen Decision routes this to the pre-enablement human check. (Updated 2026-11-06: PHOTO_DELETE_CLEANUP flag removed by user decision, so the id check is now the only guard.)

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: Run `npm run cleanup-s3:dry-run` against prod inventory to settle whether legacy key shapes (extension-less, pre-rename layout) still exist for deleted photos and add them to the delete set if so.
  evidence: Review pass 1 triage #10 — `_deleteUpload` deletes an extension-less key, and `migrations/20250719120000-rename-s3-objects.js` implies a historical layout; AC1's "bucket listing shows none" is only proven for the four modern shapes. The dry-run report classifies such keys and settles it.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: Dry-run the unconditional cleanup on the TEST stack first (delete a photo there, verify objects gone + CDN refetch fresh within an hour) before promoting to prod — with the PHOTO_DELETE_CLEANUP flag removed there is no kill switch short of a rollback deploy.
  evidence: User decision 2026-11-06 ("no flag, unconditional cleanup"); replaces the per-environment flag verification entry from review pass 1 triage #1 / pass 2 row 12, which became moot.
