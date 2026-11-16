/* eslint-env node */
/* global require, module, process, console */

// Which bucket the media and its <id>.json sidecars live in - asked once, in one place, by every
// reader in this folder. The writers on the other side reach for the same variable through
// lambda-fns/utilities/seoSidecar.ts (seoSidecarBucket), which refuses to guess; this copy exists
// only because the folder is deployed as a raw zip (Code.fromAsset, no bundler) and cannot import
// anything outside it. tests/edge-detail-truthfulness.js pins the variable name on both sides so
// the two copies cannot drift into reading different buckets.
const ENV_VAR = 'WISAW_IMG_BUCKET'

// The fallback is what an edge runs with no environment at all - which is every deployment until
// lib/resources/lambdas.ts passes the variable, because Lambda@Edge functions used to get none.
// It names production, so a staging edge silently reads prod sidecars rather than failing loudly;
// that is why the fallback is logged once per container instead of silently.
const FALLBACK_BUCKET = 'wisaw-img-prod'

let warned = false

function imgBucket () {
  const configured = String(process.env[ENV_VAR] ?? '').trim()
  if (configured !== '') return configured
  if (!warned) {
    warned = true
    console.warn(`no ${ENV_VAR} configured, reading media and sidecars from the production bucket`, { bucket: FALLBACK_BUCKET })
  }
  return FALLBACK_BUCKET
}

// Test seam: the once-per-container warning is state, and a test suite is one long-lived container.
function resetFallbackWarning () {
  warned = false
}

module.exports = { imgBucket, ENV_VAR, FALLBACK_BUCKET, resetFallbackWarning }
