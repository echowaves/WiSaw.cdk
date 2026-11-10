---
title: 'renderRootBody: structural root replacement instead of naive anchor regex'
type: 'bugfix'
ticket: ''
created: '2026-11-10'
status: 'built'
baseline_revision: '03bf4e8d9a66e1c7c433b8702542a30769fa102e'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `renderRootBody` (`lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js:71`) swaps the crawler-visible body into `<div id="root">` with `/(<div id="root">)[\s\S]*?(<\/div>)/i` and a non-global replace. The first anchor anywhere in the document wins, the nearest `</div>` wins, and nothing checks structure or the result. A `</div>` inside an HTML comment, a `<div id="root">` literal inside inline JS, nested divs in the shell, or a second anchor all make it cut the document at the wrong place — this is the mechanism that blanked production pages yesterday.

**Approach:** Replace the regex with a small linear scanner that finds the mount point outside comments/`<script>`/`<style>`, depth-counts `<div>` nesting to find *that* div's matching close, and injects there. Every failure path (no anchor, ambiguous anchors, unclosed anchor, post-condition violated) returns the **original HTML unchanged** plus one `console.error` line, so the worst outcome is today's crawler shell rather than a document that cannot boot.

## Boundaries & Constraints

**Always:**
- Keep the exported signature `renderRootBody(html = '', bodyHtml = '')` returning a string — `photo.js:75`/`video.js:84` pass `bodyHtml` positionally through `injectMetaTags`, and tests call it positionally.
- Anchor matching stays tolerant of attribute order, case, and single/double quotes (`id='root'`, `class="x" id="root"`).
- Fail-safe: on any ambiguity or post-condition failure return the input HTML byte-for-byte and log once via `console.error('<phrase>:', detail)` (repo convention, e.g. `sidecar.js:78`).
- Post-condition on the produced output before returning it: still contains `<script type="module"`, the shell's stylesheet `<link rel="stylesheet"`, and exactly one `id="root"` mount point.
- Every cyclomatic complexity ≤ 8 — extract helpers, early returns.
- SEO head bytes stay byte-identical for the served shell; existing assertions in `tests/seo-crawler-contract.js` must keep passing unchanged.
- New tests live in `tests/inject-meta-tags.js` (the `buildSeoBody + renderRootBody` block at :185) and one byte-exact regression case in `tests/seo-crawler-contract.js`.

**Never:**
- No cheerio/parse5/htmlparser or any new dependency; no `eval`; no second pass over the whole document with a greedy regex.
- Do not touch `stripExistingMetaTags`, the `<title>`/canonical rewrites, `photo.js`, `video.js`, the client repo, or any CDK/deploy code. No `cdk deploy`/AWS calls.
- Do not change `tests/fixtures/served-index.html` (it is a curl snapshot of production); hostile HTML goes inline in tests.
- No hard-coded secrets; no `.env` edits.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | `tests/fixtures/served-index.html` + SEO body, one anchor, placeholder `<h1>/<h2>` inside root | Placeholder replaced by SEO body; module script, stylesheet, stale-deploy guard scripts untouched; exactly one `id="root"` | No error expected |
| Nested divs | Root contains nested `<div>`s and a sibling `<div>` follows root in `<body>` | Depth count stops at root's own close; content after it survives byte-for-byte | No error expected |
| Decoy close | `<!-- … </div> … -->` comment before the anchor (as in the real shell's stale-deploy guard) | Comment ignored when locating close; injection correct | No error expected |
| Decoy anchor | `<div id="root">` literal inside an inline `<script>` string earlier in the document | Script content skipped; real mount point used | No error expected |
| Ambiguous mount | Two real `<div id="root">` anchors | Return input HTML unchanged, log once | Fail-safe + `console.error` |
| Missing/unclosed anchor | No `id="root"` div, or anchor with no matching `</div>` | Return input HTML unchanged, log once | Fail-safe + `console.error` |
| Post-condition violated | Shell where the matched close would swallow `<script type="module">` or the stylesheet | Reject produced output; return input HTML unchanged, log once | Fail-safe + `console.error` |
| Nullary/degenerate input | `bodyHtml === ''`, `html` undefined/non-string | Byte-identical return of the input (today's behavior for `''`) | No error expected |

</frozen-after-approval>

## Code Map

- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` -- target. `renderRootBody:71` (rewrite), `injectMetaTags:163` calls it at `:253` only when `bodyHtml` is truthy; exports at `:324`. Same file already holds `escapeHtmlAttribute`, `stripExistingMetaTags`, `buildSeoBody` — helpers stay in this file (CommonJS, `/* eslint-env node */ /* global module */` header).
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js:61,75` and `video.js:68,84` -- only production callers; pass `bodyHtml` positionally inside the options object. Untouched.
- `tests/inject-meta-tags.js` -- chai `expect`, mocha `describe/it`; `BASE_HTML` template at :9; existing renderRootBody cases at :250-257 (`equal` assertions). New matrix tests go in the `:185` describe block.
- `tests/seo-crawler-contract.js` -- loads the real shell into `SHELL` at :24; `describe('injectMetaTags against the served shell')` at :266 already asserts `<div id="root">` survives and script count is unchanged (`:296`, `:302`). Add the byte-exact hostile-shell case here.
- `tests/fixtures/served-index.html` -- 5,166 B, no trailing newline, exactly one `<div`/`</div>`; contains a comment mentioning `#root`, an inline stale-deploy `<script>`, `<script type="module" crossorigin src="/assets/index-gvkStkWF.js">`, and `<link rel="stylesheet" crossorigin href="/assets/index-CXkA7Bri.css">`. Read-only fixture.
- `lib/resources/lambdas.ts:300-348` -- Lambda@Edge wiring: `memorySize: 128`, `timeout: 5s`, whole folder bundled as entry, created only when `DEPLOY_ENV=prod`. Runtime budget ⇒ scanner must stay linear and allocation-light; no new files needed.

## Tasks & Acceptance

**Execution:**
- [x] `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` -- Replace the regex body of `renderRootBody` with: a tag-walking helper that yields `<div>`/`</div>` tokens outside comments, `<script>`, and `<style>`; an anchor finder returning the single `id="root"` div's open-tag end index (null when zero or ≥2 anchors); a depth-counting close finder; a post-condition check on the produced HTML; and the exported `renderRootBody(html, bodyHtml)` orchestrating them with early returns and one `console.error` per fail-safe path. Keep the signature and export list unchanged.
- [x] `tests/inject-meta-tags.js` -- Add one test per row of the I/O matrix (8) in the `buildSeoBody + renderRootBody` block, asserting both the injected result and, for fail-safe rows, that output `=== input` byte-for-byte; stub `console.error` to prove the log fires exactly once on each fail-safe path.
- [x] `tests/seo-crawler-contract.js` -- Add a byte-exact case running `injectMetaTags` over a hostile shell (comment decoy + nested divs + script-string decoy anchor) asserting head bytes are unchanged against the current served-shell expectation and that module script, stylesheet, and single anchor survive.
- [x] `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` -- Secondary assessment (read-only): audit `stripExistingMetaTags`, the `/<title>.*?<\/title>/i` rewrite, `canonicalPattern`, and the `'</title>'` anchor in `injectMetaTags`/`injectRouteTags` for the same first-anchor-wins failure mode; record findings in `## Implementation Notes` as fix-now / defer-to-`deferred-work.md`, changing no code this pass.

**Acceptance Criteria:**
- Given a shell whose comments or inline scripts contain `<div id="root">` or `</div>`, when the injector runs, then the crawler body lands inside the real mount point and every script/stylesheet tag in the shell is still present.
- Given a document with two real mount points or an unclosed one, when injection is attempted, then the returned HTML equals the input byte-for-byte and exactly one `console.error` line is emitted — never a partially rewritten document.
- Given any produced output missing the module script, the stylesheet, or exactly-one anchor, when the post-condition runs, then that output is discarded in favour of the input.
- Given the served shell and today's options, when `npm test` runs, then `tests/seo-crawler-contract.js` and `tests/inject-meta-tags.js` pass with SEO head bytes unchanged and no new failures beyond the five known `getSeasonBoundaries` ones.

## Implementation Notes

### What shipped (tasks 1-3)

`renderRootBody` no longer uses a regex. It composes three small helpers, all CommonJS and dependency-free so the esbuild bundle stays one file:

- `maskNonStructural(html)` — builds an index-aligned copy of the document with every HTML comment and every raw-text element body (`script`, `style`, `textarea`) blanked to spaces, so a `<div>`/`</div>` written inside them is characters rather than structure. Blanking preserves length, so offsets found in the mask cut the real string.
- `findRootOpenEnd(html, mask)` — returns the offset just after the opening tag only when **exactly one** `<div>` carries a real `id="root"` attribute (`(?:^|\s)id\s*=\s*['"]?root['"]?(?=[\s/>])`, so `data-id="root"`, `id="rooting"` and tokens inside comments/scripts do not count). Zero or 2+ candidates → `null`.
- `findRootCloseStart(html, mask)` — depth-counts `<\/?div\b[^>]*>` from the anchor to the matching close; unclosed → `null`.

`renderRootBody` returns the input byte-for-byte plus one `console.error('renderRootBody skipped:', why, '- serving shell unchanged')` on every fail-safe path, and asserts a post-condition before returning: boot-critical markup (module script, stylesheet, any `<script`) must not **decrease** versus the input, and the output must hold exactly one anchor. The "must not decrease" wording is load-bearing — `buildSeoBody` always adds its own `application/ld+json` script, so an equality test would reject every legitimate injection (caught by the scratch harness before any test was written).

Matrix rows 1-8 each have a test in `tests/inject-meta-tags.js` (`renderRootBody - mount point located structurally`); `tests/seo-crawler-contract.js` adds a byte-exact case proving head bytes are identical when the shell carries decoy anchors after `<body>`. Signature `(html, bodyHtml)` unchanged — `photo.js`/`video.js` call it positionally.

### Task 4 - secondary assessment of the same naive-anchor pattern in the head rewrites

Probes ran against the real served fixture with decoys injected (read-only; no code changed this pass, per the brief).

| # | Site | Probe result | Exposure today | Decision |
|---|------|--------------|----------------|----------|
| S1 | `'</title>'` string anchor, `injectMetaTags:406` and `injectRouteTags:480` | A comment placed before `<title>` containing the token `</title>` swallowed the **entire** meta block into that comment (`<!-- legacy </title> <meta … -->`). Tag counts still look correct (og:title count 1) while the head serves nothing - silent SEO loss, same class as the outage. | None: served shell has one `<title>`, no decoy token. Latent - a client-side template change can create it. | **Defer** (highest priority of the four; fix = locate the real `</title>` with the masking helpers now in utils.js) |
| S2 | `canonicalPattern` at `injectMetaTags:397` / `injectRouteTags:462` | (a) `rel = "canonical"` (spaces around `=`) is not matched, so the rewrite misses and the fallback injects a second canonical - 1 in, **2 out**, stale one left behind. (b) The replace is non-global: with two static canonicals only the first is rewritten; `/second` survives pointing elsewhere. Both are duplicate-canonical signals - the exact mechanism that deindexed ~22k pages. | None: served template ships no static canonical, and deployed bytes use `rel="canonical"`. | **Defer** (needs `\s*=\s*` plus strip-all-then-insert-one semantics, each with a byte-exact pin) |
| S3 | `/<title>.*?<\/title>/i` at `injectMetaTags:367` lacks `/s`, while `injectRouteTags:453` has `/is` | A title spanning two lines is left untouched on the media path: new page title never written, generic homepage title kept -> deep pages wearing the homepage title again. | None: served title is single-line. | **Defer** (one-flag fix, but it changes head bytes and needs its own regression pin) |
| S4 | `stripExistingMetaTags` (`utils.js:29-40`) runs global `/gi` strips over the whole document, not just `<head>` | A string literal containing `<meta property="og:image" content="x">` inside the inline reload script was deleted out of the JavaScript - the statement no longer survived in the response. Body-level crawler markup is safe (it uses `h1`/`p`/`a` only). | None today; any future bundle that embeds meta-like text in JS/comments gets corrupted at the edge. | **Defer** (brief's Never list names this function) |

All four are recorded in `_bmad-output/seo-indexing/deferred-work.md`. None of them is the outage mechanism, none is reachable with the bytes currently deployed, and fixing any of them rewrites head bytes - which deserves its own byte-exact pin rather than riding along with a body-render fix.

### Corrections after review (patch from triage row 1)

- Signatures in the bullet list above are shorthand; as shipped they take the masked copy: `findRootOpenEnd(masked)` and `findRootCloseStart(masked, openEnd)`. The real document is cut with those offsets because masking is index-aligned.
- `maskNonStructural` now skips a `<` that cannot open markup (`TAG_START_CHAR = /[a-zA-Z/?!]/`). Without it, text like `100 < 50%` merged the following `<script>` into one bogus tag, unmasked the script body, and let a decoy `</div>` inside a JS string cut the page - leaving an orphaned tail that still contained a `<script>`, so the post-condition passed on a broken document. Two regression tests pin this in `tests/inject-meta-tags.js`.
- Masking deliberately does **not** blank `<noscript>` contents: they are real markup when scripting is off, so a mount point written there must still count. The bias is towards refusing injection (fail-safe) rather than guessing.

## Plan Change Log

## Review Triage Log

Quick lens (`lenses_ran: ['quick']`, loop 0). One finding reported; one further claim raised during verification of it.

| # | Finding (location) | Verdict | Evidence | Route |
|---|---|---|---|---|
| 1 | `maskNonStructural` treats every `<` as a tag start, so bare `<` in text desynchronises the scan and re-exposes raw-text contents to the depth counter (`utils.js:151-170`, guard now at :160-163) | **high** | Ran the reviewer's input against a copy of the pre-fix scanner: `renderRootBody` returned a corrupted document — `<div id="root">…</script></div>';</script><p>STALE</p></div>` — with the orphaned tail still holding a `<script>`, so the boot-critical post-condition did not catch it. Real give-up *and* real mis-cut on valid HTML (`100 < 50%` in shell copy). | patch |
| 2 | `</textarea>` written inside script text ends masking early (self-raised while verifying #1; `maskRawTextThrough`/`indexOfCloseTag`, utils.js:112-119, :134-145) | **false** | Checked at the cited location: `indexOfCloseTag` compares the candidate close tag against the element's own name (`html.slice(i + 2, i + 2 + name.length).toLowerCase() === name`), so `</textarea>` cannot terminate a `script` mask. Ran that exact input against the pre-fix copy — injection succeeded, stale content gone, no debris. Refuted. | rejected (test added to pin the rule) |

Grouping: one entry, root cause "masker assumed every `<` opens markup", verdict high, route **patch**. No intent_gap / bad_plan entries → no loopback; `review_loop_iteration` stays 0.

Patch applied (#1 — the step-03 implementation subagent is unavailable in this session, so the patch was applied here): `TAG_START_CHAR = /[a-zA-Z/?!]/` guard skips a `<` that cannot open markup. Regression tests added: `treats a bare < in text as text, not as a tag start`, `masks a script whose text mentions another element close tag`.

Post-patch verification (plan `## Verification` re-run): `tests/inject-meta-tags.js` 51 passing; `tests/seo-crawler-contract.js` 35 passing; `npm test` 237 passing / 5 failing — exactly the five documented pre-existing `getSeasonBoundaries` timezone failures; `ts-standard` on both touched files reports only the pre-existing `tests/inject-meta-tags.js:126` `no-unused-expressions` finding (same statement exists at HEAD).

## Design Notes

Scanner shape (linear, single pass over tags; helpers keep each function ≤ 8 branches):

```
nextTag(html, from) -> {name, isClose, tagEnd, inComment|inScript|inStyle} // skips <!-- -->, <script>…</script>, <style>…</style>
findRootOpen(html)  -> index after the anchor's open tag, or null when count !== 1
findMatchingClose(html, from) -> index of the anchor div's own </div>, or -1   // depth++ on <div>, depth-- on </div>
isBootable(html)    -> module script && stylesheet && exactly one id="root"
renderRootBody      -> guard empty body → locate → inject → post-condition → return or fail-safe
```

Anchor detection reads the open tag's attributes (`/\bid\s*=\s*(["'])root\1/i` on the tag text only), so `data-id="x"` and comments cannot produce a false anchor.

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/inject-meta-tags.js` -- expected: all pass, including the 8 new matrix cases.
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` -- expected: all pass; served-shell head bytes and script count assertions unchanged.
- `npm run lint` -- expected: ts-standard clean (no new warnings).
- `npm test` -- expected: no failures beyond the 5 pre-existing `getSeasonBoundaries` timezone failures on main.

**Manual checks:**
- Confirm `git diff --stat` touches only `utils.js`, `tests/inject-meta-tags.js`, `tests/seo-crawler-contract.js` (+ this plan).
