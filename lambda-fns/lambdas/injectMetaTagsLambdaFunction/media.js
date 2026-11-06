/* eslint-env node */
/* global require, module, console */

// Existence + freshness probe for the media object behind a photo/video URL.
//
// This must not produce false negatives: answering 404 for a live page removes it from
// Google's index, which is the exact damage this change-set is trying to undo. So instead
// of HeadObject on one guessed extension (the old code assumed every video was <id>.mov),
// we list the id prefix and accept any real object - .webp, .mov, .mp4, a thumbnail. Only a
// definitively empty listing counts as "gone".
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3')

const VIDEO_EXT_RE = /\.(mov|mp4|webm|m4v)$/i

const client = new S3Client({ region: 'us-east-1' })

function isDefinitiveMiss (err) {
  const code = err && err.$metadata && err.$metadata.httpStatusCode
  const name = (err && err.name) || ''
  return code === 404 || name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket'
}

/**
 * @param {string} bucket media bucket
 * @param {string} imageIdRaw canonical id
 * @returns {Promise<{exists: boolean, lastModified: string, key: string, inconclusive: boolean}>}
 */
async function probeMedia (bucket, imageIdRaw) {
  try {
    const { Contents = [] } = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: `${imageIdRaw}.`, MaxKeys: 8 })
    )
    if (Contents.length === 0) return { exists: false, lastModified: '', key: '', inconclusive: false }

    // Prefer the media itself over a thumbnail so LastModified reflects the upload.
    const preferred = Contents.find((o) => VIDEO_EXT_RE.test(o.Key)) ||
      Contents.find((o) => !/\.webp$/.test(o.Key) || !o.Key.endsWith('-thumb.webp')) ||
      Contents[0]

    return {
      exists: true,
      lastModified: preferred.LastModified ? preferred.LastModified.toISOString() : '',
      key: preferred.Key,
      inconclusive: false
    }
  } catch (err) {
    if (isDefinitiveMiss(err)) return { exists: false, lastModified: '', key: '', inconclusive: false }
    // AccessDenied or a throttled S3 answer is not evidence that media is missing: keep
    // rendering so a permission mistake cannot mass-404 the photo surface.
    console.error('media probe inconclusive:', (err && err.name) || 'error', err && err.message)
    return { exists: true, lastModified: '', key: '', inconclusive: true }
  }
}

/** Duration metadata written by the upload pipeline; '' when unavailable. */
async function readDuration (bucket, key) {
  if (!key || !VIDEO_EXT_RE.test(key)) return ''
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return (head.Metadata && head.Metadata.duration) || ''
  } catch (err) {
    console.error('duration read failed:', (err && err.name) || 'error', err && err.message)
    return ''
  }
}

module.exports = { probeMedia, readDuration }
