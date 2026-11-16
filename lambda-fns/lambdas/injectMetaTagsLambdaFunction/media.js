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
const { isVideoObjectKey, isImageObjectKey, isThumbnailObjectKey, isSidecarObjectKey, pickVideoObjectKey } = require('./mediaNaming')

const client = new S3Client({ region: 'us-east-1' })

function isDefinitiveMiss (err) {
  const code = err && err.$metadata && err.$metadata.httpStatusCode
  const name = (err && err.name) || ''
  return code === 404 || name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket'
}

function answer (fields) {
  return Object.assign({ exists: false, lastModified: '', key: '', hasImage: false, hasVideo: false, inconclusive: false }, fields)
}

/**
 * @param {string} bucket media bucket
 * @param {string} imageIdRaw canonical id
 * @returns {Promise<{exists: boolean, lastModified: string, key: string, hasImage: boolean,
 *   hasVideo: boolean, inconclusive: boolean}>} `hasImage` means a full derivative (not a
 *   thumbnail) is stored, `hasVideo` that a playable object is; the two together are what tells a
 *   page's URL kind from storage instead of from the URL.
 */
async function probeMedia (bucket, imageIdRaw) {
  try {
    const { Contents = [] } = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: `${imageIdRaw}.`, MaxKeys: 8 })
    )
    // A sidecar describes media; it is not media. Counted as an object it kept a deleted photo's
    // page answering 200 forever - with an image that 403s, which is the soft-404 shape this probe
    // exists to remove. Only a listing with no real object left of it says "gone".
    const objects = Contents.filter((o) => !isSidecarObjectKey(o.Key))
    if (objects.length === 0) return answer({})

    const keys = objects.map((o) => o.Key)
    // Kind is read off what is actually stored. pickVideoObjectKey has a documented fallback that
    // invents <id>.mov for callers with no storage information, so asking it "is this a video" would
    // answer yes for every photo - the two kinds are tested against the listing itself, and its
    // deterministic pick is only used to choose between objects that really exist.
    const hasVideo = keys.some((key) => isVideoObjectKey(key))
    // Every video also has a -thumb.webp, so only the full derivative proves this id is a photo.
    const hasImage = keys.some((key) => isImageObjectKey(key))
    const videoKey = pickVideoObjectKey(imageIdRaw, keys)

    // Prefer the media itself over a thumbnail, whose mtime moves whenever one is regenerated and
    // which must not become the page's capture date.
    const preferred = (hasVideo && objects.find((o) => o.Key === videoKey)) ||
      objects.find((o) => isImageObjectKey(o.Key)) ||
      objects.find((o) => !isThumbnailObjectKey(o.Key)) ||
      objects[0]

    return answer({
      exists: true,
      lastModified: preferred.LastModified ? preferred.LastModified.toISOString() : '',
      key: preferred.Key,
      hasImage,
      hasVideo
    })
  } catch (err) {
    if (isDefinitiveMiss(err)) return answer({})
    // AccessDenied or a throttled S3 answer is not evidence that media is missing: keep
    // rendering so a permission mistake cannot mass-404 the photo surface. Kind stays unknown,
    // which is also why an inconclusive probe must never redirect to the other kind.
    console.error('media probe inconclusive:', (err && err.name) || 'error', err && err.message)
    return answer({ exists: true, inconclusive: true })
  }
}

/**
 * Duration claimed by an object's own user metadata, or '' when it has none. Kept as the reader's
 * fallback only: production uploads never wrote this key (evidence/probe-duration-metadata.js found
 * it on 0 of 106 sampled videos), so the value that reaches a page normally comes from the record,
 * which learned it from the container itself.
 */
async function readDuration (bucket, key) {
  if (!key || !isVideoObjectKey(key)) return ''
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return (head.Metadata && head.Metadata.duration) || ''
  } catch (err) {
    console.error('duration read failed:', (err && err.name) || 'error', err && err.message)
    return ''
  }
}

module.exports = { probeMedia, readDuration }
