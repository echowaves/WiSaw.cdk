/* eslint-env node */
/* global require, module, console */

// Per-photo SEO text lives in Postgres, which Lambda@Edge cannot reach (edge functions
// cannot join a VPC). The generateSiteMap job therefore publishes a tiny sidecar per
// photo next to the media itself, and the edge injector reads that. Sidecars are written
// at most once per photo per run and photos are immutable, so caching them at the edge is
// safe; the TTL only matters when a caption is edited or a moderation job adds labels.
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')

const SIDECAR_TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 500
const cache = new Map()

function bucketName () {
  return process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
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
 * Read seo/<id>.json for a media id.
 * @returns {Promise<object|null>} parsed sidecar, or null when it does not exist yet.
 */
async function fetchSidecar (imageId) {
  const id = String(imageId || '')
  if (!id) return null

  const key = `seo/${id}.json`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < SIDECAR_TTL_MS) return hit.value

  try {
    const client = new S3Client({ region: 'us-east-1' })
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: bucketName(), Key: key })
    )
    const parsed = JSON.parse(await Body.transformToString())
    remember(key, parsed)
    return parsed
  } catch (err) {
    // NoSuchKey / AccessDenied are normal for freshly uploaded media: render without
    // enriched text rather than failing the request.
    if (err && err.name !== 'NoSuchKey' && err.name !== 'NotFound') {
      console.error('sidecar read failed:', err.message)
    }
    remember(key, null)
    return null
  }
}

module.exports = { fetchSidecar }
