/* eslint-env node */
/* global require, module, process, console */

// Which bucket the media and its <id>.json sidecars live in - asked once, in one place, by every
// reader in this folder. The writers on the other side reach for the same fact through
// lambda-fns/utilities/seoSidecar.ts (seoSidecarBucket), which refuses to guess; this copy exists
// because the folder is deployed as a raw zip (Code.fromAsset, no bundler) and cannot import
// anything outside it. tests/seo-crawler-contract.js pins both sides so they cannot drift into
// reading different buckets.
//
// Order, most authoritative first:
//   1. WISAW_IMG_BUCKET - only ever set by a developer or a test. Lambda@Edge rejects environment
//      variables (LambdaEdgeEnvironmentVariablesNotAllowed), so no deployed edge has it.
//   2. bucket.gen.js - written into this folder by `cdk synth` (lib/utilities/edgeMediaBucket.ts).
//      This is what a deployed edge actually reads.
//   3. The production name, logged once per container: reading the wrong corpus looks exactly like
//      a healthy page that happens to describe someone else's photo, so silence is not an option.
const ENV_VAR = 'WISAW_IMG_BUCKET'
const FALLBACK_BUCKET = 'wisaw-img-prod'

let warned = false

function generatedBucket () {
  try {
    // Required inside the function: the file only exists after a synth has run, and a missing one
    // is a configuration fact to report, not a crash on somebody's page request.
    const value = String(require('./bucket.gen.js').BUCKET ?? '').trim()
    return value === '' ? null : value
  } catch (err) {
    return null
  }
}

function imgBucket () {
  const fromEnv = String(process.env[ENV_VAR] ?? '').trim()
  if (fromEnv !== '') return fromEnv

  const generated = generatedBucket()
  if (generated !== null) return generated

  if (!warned) {
    warned = true
    console.warn(`no ${ENV_VAR} and no generated bucket constant, reading media and sidecars from the production bucket`, { bucket: FALLBACK_BUCKET })
  }
  return FALLBACK_BUCKET
}

// Test seam: the once-per-container warning is state, and a test suite is one long-lived container.
function resetFallbackWarning () {
  warned = false
}

module.exports = { imgBucket, ENV_VAR, FALLBACK_BUCKET, resetFallbackWarning }
