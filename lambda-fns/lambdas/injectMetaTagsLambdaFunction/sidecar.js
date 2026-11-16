/* eslint-env node */
/* global require, module, console */

// Per-photo SEO text lives in Postgres, which Lambda@Edge cannot reach (edge functions
// cannot join a VPC). The generateSiteMap job therefore publishes a tiny sidecar per
// photo next to the media itself, and the edge injector reads that. Sidecars are written
// at most once per photo per run and photos are immutable, so caching them at the edge is
// safe; the TTL only matters when a caption is edited or a moderation job adds labels.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { PRECISE_KEYS, isPreciseLocation } = require('./seoRules')

const SIDECAR_TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 500
const cache = new Map()

function bucketName () {
  return process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
}

// A sidecar may name the place - "Coney Island, New York" is what makes a photo rankable - but
// it must never carry a position: no lat/lon pair, no POINT(), no WKB hex off the geography
// column. The writers refuse to build such an object (seoRules.js owns that guard, and this reader
// imports the very same functions rather than restating them), and the reader drops one too,
// because objects written before the guard ran are still in S3 - and in this cache for up to
// SIDECAR_TTL_MS.
function stripPreciseLocation (parsed) {
  if (parsed == null || typeof parsed !== 'object') return parsed
  for (const key of PRECISE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) delete parsed[key]
  }
  if (isPreciseLocation(parsed.location)) delete parsed.location
  return parsed
}

function remember (key, value) {
  if (cache.size >= MAX_ENTRIES) {
    // Cheap FIFO eviction; entries are small and the working set is "recently crawled".
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, { value, at: Date.now() })
}

/**
 * Read the <id>.json sidecar for a media id. The sidecar sits at the bucket root next to
 * <id>.webp; string concatenation only, per the edge-runtime constraint in this folder.
 * @returns {Promise<object|null>} parsed sidecar, or null when it does not exist yet.
 */
async function fetchSidecar (imageId) {
  const id = String(imageId || '')
  if (!id) return null

  const key = id + '.json'
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < SIDECAR_TTL_MS) return hit.value

  try {
    const client = new S3Client({ region: 'us-east-1' })
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: bucketName(), Key: key })
    )
    const parsed = stripPreciseLocation(JSON.parse(await Body.transformToString()))
    remember(key, parsed)
    return parsed
  } catch (err) {
    const name = (err && err.name) || ''
    // Absent is a real answer worth caching: freshly uploaded media has no sidecar yet, and the
    // corpus is large. Anything else is not - one throttled S3 answer or a slipped IAM permission
    // used to blank this photo's title at that POP for ten minutes, with nothing in the response to
    // show why. Uncached failures cost one retry on the next request instead.
    if (name === 'NoSuchKey' || name === 'NotFound') {
      remember(key, null)
      return null
    }
    console.error('sidecar read failed; not caching', key, name || 'error')
    return null
  }
}

// The two guards are exported for tests/seo-crawler-contract.js: "no object ever reaches the
// injector with a coordinate in it" has to be pinned by a test, not assumed from the writers.
module.exports = { fetchSidecar, stripPreciseLocation, isPreciseLocation }
