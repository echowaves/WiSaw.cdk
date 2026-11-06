## Digest — Q6: why concatenation, byte-exact matching, and the prod gate

### History claims

**String concatenation (unexplained in history; contradicted by shipped code)**
- LB `f18a623 "refactor: replace template literals with string concatenation in injectMetaTags function"` (2025-11-22 19:02) converted the `<title>` and canonical `.replace()` replacements only. No body, no PR — commits from that era reached main directly (first merge containing them is #12, Apr 2026).
- LB `625562a` same subject (2025-11-22 19:38) converted the og/twitter metaTags block (`metaTags` at utils.js:198+ @ 3813371). It does **not** revert f18a623; it's a distinct hunk ~36 min later, with `5ac9513` and `7802e88` (also style commits) between.
- Both sit inside a same-day repo-wide lint/style sweep (`cb72190`/`7ffb82c` "add ESLint environment declaration", quote/formatting standardization — ~25 commits on 2025-11-22). No commit body or PR states *why* template literals were removed.
- Counter-evidence: `c872eed` introduced `buildSeoBody` with template literals (utils.js:104-156 @ c872eed, blame 53/53 lines) in the same deployed asset, and `49f8013 "feat(seo): publish and read per-photo SEO sidecars at the edge"` body states "This is the code deployed to prod at 2026-11-06T13:27Z". utils.js still has 17 backtick lines @ 3813371; the asset ships raw via `lambda.Code.fromAsset` + `NODEJS_22_X` (lib/resources/lambdas.ts:300+). A literal "edge runtime rejects template literals" constraint is not consistent with what runs in prod.

**Byte-exact canonical matching — live incident, documented**
- LB `c872eed "fix(seo): byte-tolerant canonical rewrite + crawler-visible body in edge injector"` (2026-11-05), merged via `76878f9 "Merge branch 'fix/seo-canonical-edge-injector'"` — no PR exists. Body (agent co-authored; matches the diff): "The canonical replacement in injectMetaTags compared against one exact literal … that never matched the deployed template bytes (rel='canonical' with a space before />). The miss was silent: every photo/video URL kept canonical -> https://wisaw.com, so Google treated ~22k pages as duplicates of the homepage and dropped them from the index."
- utils.js:217-223 (`canonicalPattern`) @ c872eed; tests/inject-meta-tags.js:142 `describe('injectMetaTags - canonical rewrite (2026-11 indexing incident)')` @ c872eed, comment: "These fixtures must stay byte-exact." The superseded exact-literal replace is visible as context in f18a623's diff.

**DEPLOY_ENV=prod gate — inherited, never separately decided**
- Mechanism: `f2902ca "multi stage deployment"` (2021-02-15), `47f5037 "more conditional logic for prod vs test"`. No bodies.
- LB First `if(deployEnv() === 'prod')`: `f047ba5 "adding generate sitemap lambda function"` (2021-07-24) — gated the *sitemap* Lambda, not edge; no reason recorded.
- LB Lambda@Edge was **born inside** that gate: `d9d9f08 "plugging in the lambda edge meta manupulation function"` (2022-06-17) added the injectMetaTags EdgeFunction + CloudFront within the existing prod block. No separate decision record.
- The cited lines blame to `12d29c3 "feat: Upgrade version to 0.3.0 and refactoring resources to address codacy complexity issue"` (2025-11-24): lib/resources/lambdas.ts:222 @ 12d29c3 and cloud-front.ts:9 early return @ 12d29c3 are the stack split preserving/re-expressing the gate; `deployEnv() ?? 'test'` (config.ts:1-2) @ 12d29c3 makes prod resources opt-in. `cafc23d "fixed prod deploy"` (2023-05-26) checked — only an asset-path fix, not the gate.

**Dated patterns**
- template.js:4 fetchShell header (~21k URLs 5xx): introduced and last touched by `49f8013`, 2026-11-06 09:22 -0500.
- media.js:6 probeMedia header (false-negative 404s): introduced and last touched by `49f8013`, same commit/date.

### Decisions shown in history
1. **Regex canonical rewrite over literal replace** — chosen at c872eed (`canonicalPattern` regex + inject-if-absent) because byte variance between code and deployed template caused a silent ~22k de-indexing; byte-exact fixtures kept as regression tests (commit body + test comment).
2. **Template literals → concatenation in `injectMetaTags` only** — f18a623 then 625562a, chosen over template literals with no stated reason; consistent with the day's ESLint sweep. Convention retained afterward (49f8013 writes concatenation at utils.js:215) despite template literals shipping in prod elsewhere in the same function.
3. **Prod-only edge** — not a recorded decision: d9d9f08 placed new edge resources inside f047ba5's pre-existing prod block; 12d29c3 restated it during the Codacy refactor with `deployEnv()` defaulting to `'test'`, so CloudFront/edge simply don't exist in test stacks.

### Not settled (budget: 9 of 10 commits followed; stopped after f2902ca message check)
- The actual motivation for the concatenation conversion — no body, PR, or issue anywhere (`gh` searches empty); lint-sweep context is circumstantial, and shipped prod code undercuts a runtime-constraint reading.
- Whether any deployment failure specifically triggered f18a623/625562a (the interleaved `5ac9513` "remove unnecessary trailing commas in response headers" hints at deploy-error iteration, but says nothing explicit).
- No issue exists for the 2026-11 incident; c872eed's body and code comments are its only record.
- Why edge is prod-only was never written down; single hardcoded `wisaw.com` distribution / us-east-1 edge resources is inference from structure, not a cited rationale.
