/* eslint-env node */
const { expect } = require('chai')
const { describe, it, afterEach } = require('mocha')

const { S3Client } = require('@aws-sdk/client-s3')

const { probeMedia } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/media')
const { fetchSidecar, isPreciseLocation: readerGuard } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar')
const { PRECISE_KEYS, isPreciseLocation: writerGuard } = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules')
const photoHandler = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo').handler
const videoHandler = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/video').handler

// Two ids that cannot collide with the reader's in-memory caches (sidecar and shell are both
// module-level), so each case starts from a cold cache without needing a test-only reset hook.
const PHOTO_ID = '29461ee8-34dd-4c2b-848f-c16d766713e8'
const VIDEO_ID = '7c1f9a02-5b3d-4f61-9c8e-2ad0b7e4f155'
const IMG_BUCKET = process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'

// Captured before any stub runs: every restore puts this back, so a case can never leave a fake
// installed for the next one (which is how a listing from an earlier test once answered a later
// probe and made a photo page look like a redirect).
const ORIGINAL_SEND = S3Client.prototype.send

const dateOf = (day) => new Date(`2026-10-0${day}T00:00:00.000Z`)

/** Listing a photo id really has: full derivative, thumbnail, sidecar. */
function photoListing (id = PHOTO_ID) {
  return [
    { Key: `${id}.webp`, LastModified: dateOf(1) },
    { Key: `${id}-thumb.webp`, LastModified: dateOf(2) },
    { Key: `${id}.json`, LastModified: dateOf(3) }
  ]
}

// A video upload reaches the thumb pipeline as its still poster (see the note above
// _learnVideoDuration in processUploadedImage), so a real video id usually holds a full
// <id>.webp beside the container. The listing without that poster is the shape this goal acts on:
// an id whose only playable object has no image to show at all.
function videoListing (id = VIDEO_ID, { withPoster = false } = {}) {
  const keys = [
    { Key: `${id}.mp4`, LastModified: dateOf(1) },
    { Key: `${id}-thumb.webp`, LastModified: dateOf(2) },
    { Key: `${id}.json`, LastModified: dateOf(3) }
  ]
  if (withPoster) keys.splice(1, 0, { Key: `${id}.webp`, LastModified: dateOf(1) })
  return keys
}

/**
 * Installs a fake S3 for the duration of one case. `listing` answers the id-prefix listing the
 * page probe makes (an Error in it is thrown instead), `sidecar` is the JSON text returned for
 * `<id>.json` (an Error is thrown instead), and anything else fails rather than reaching AWS.
 */
function stubS3 ({ listing = [], sidecar = null } = {}) {
  const attempts = []
  const fake = async function (cmd) {
    const name = cmd && cmd.constructor ? cmd.constructor.name : 'Command'
    const input = (cmd && cmd.input) || {}
    attempts.push({ name, key: input.Key })
    if (name === 'ListObjectsV2Command') {
      if (listing instanceof Error) throw listing
      return { Contents: listing }
    }
    if (name === 'GetObjectCommand') {
      if (sidecar instanceof Error) throw sidecar
      if (typeof sidecar === 'string') return { Body: { transformToString: async () => sidecar } }
      const err = new Error('The specified key does not exist.')
      err.name = 'NoSuchKey'
      throw err
    }
    const err = new Error(`unstubbed ${name}`)
    err.name = 'NotImplemented'
    throw err
  }
  return {
    attempts,
    install () { S3Client.prototype.send = fake },
    restore () { if (S3Client.prototype.send === fake) S3Client.prototype.send = ORIGINAL_SEND }
  }
}

let active = null
function use (stub) {
  if (active) active.restore()
  active = stub
  stub.install()
  return stub
}
afterEach(() => {
  if (active) { active.restore(); active = null }
})

function s3Error (name, message = 'denied') {
  const err = new Error(message)
  err.name = name
  return err
}

/** Minimal CloudFront origin-response event. */
function cfEvent (uri) {
  return { Records: [{ cf: { request: { uri } } }] }
}

function runHandler (handler, uri) {
  return new Promise((resolve, reject) => {
    handler(cfEvent(uri), {}, (err, result) => (err ? reject(err) : resolve(result)))
  })
}

function headerValue (response, key) {
  const entry = (response.headers || {})[key.toLowerCase()]
  return entry && entry[0] ? entry[0].value : undefined
}

describe('probeMedia - what storage actually holds', () => {
  it('does not count the SEO sidecar as media', async () => {
    // A deleted photo leaves its <id>.json behind. Counted as an object it kept the page answering
    // 200 with an image that 403s - the soft 404 this probe exists to remove.
    const stub = use(stubS3({ listing: [{ Key: `${PHOTO_ID}.json`, LastModified: dateOf(3) }] }))
    const media = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect(media.exists, JSON.stringify(stub.attempts)).to.equal(false)
    expect(media.key).to.equal('')
  })

  it('dates a page from the media object, not from the sidecar beside it', async () => {
    use(stubS3({ listing: photoListing() }))
    const media = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect(media.exists).to.equal(true)
    expect(media.key).to.equal(`${PHOTO_ID}.webp`)
    // The sidecar's mtime moves every time a comment is written; it must not become the capture date.
    expect(media.lastModified).to.equal(dateOf(1).toISOString())
  })

  it('names the kind the objects prove', async () => {
    use(stubS3({ listing: photoListing() }))
    const photo = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect([photo.hasImage, photo.hasVideo], 'photo').to.deep.equal([true, false])

    use(stubS3({ listing: videoListing() }))
    const video = await probeMedia(IMG_BUCKET, VIDEO_ID)
    expect([video.hasImage, video.hasVideo], 'video').to.deep.equal([false, true])
    expect(video.key).to.equal(`${VIDEO_ID}.mp4`)
  })

  it('does not read a photo as a video just because the naming rule has a fallback', async () => {
    // pickVideoObjectKey invents <id>.mov for callers with no storage information. If the probe
    // asked it whether a video exists, every photo page would answer yes.
    use(stubS3({ listing: photoListing() }))
    const media = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect(media.hasVideo).to.equal(false)
    expect(media.key).to.not.match(/\.mov$/)
  })

  it('treats a thumbnail as neither kind', async () => {
    // Every video also has a -thumb.webp, so a thumb-only listing proves nothing about kind; the
    // page keeps rendering and is never redirected on that evidence.
    use(stubS3({ listing: [{ Key: `${PHOTO_ID}-thumb.webp`, LastModified: dateOf(2) }] }))
    const media = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect(media.exists).to.equal(true)
    expect([media.hasImage, media.hasVideo]).to.deep.equal([false, false])
  })

  it('keeps answering when S3 answers with a permission error', async () => {
    use(stubS3({ listing: s3Error('AccessDenied') }))
    const media = await probeMedia(IMG_BUCKET, PHOTO_ID)
    expect(media.exists).to.equal(true)
    expect(media.inconclusive).to.equal(true)
    expect([media.hasImage, media.hasVideo]).to.deep.equal([false, false])
  })
})

describe('the detail injector publishes the kind storage proves', () => {
  it('moves /videos/<id> to /photos/<id> when the id holds a photo', async () => {
    // Typo'd or stale app links used to publish og:video and a VideoObject naming <id>.mov, an
    // object nobody wrote: every player and rich result on that page pointed at a 403.
    use(stubS3({ listing: photoListing() }))
    const response = await runHandler(videoHandler, `/videos/${PHOTO_ID}`)
    expect(response.status).to.equal('301')
    expect(headerValue(response, 'location')).to.equal(`https://wisaw.com/photos/${PHOTO_ID}`)
    expect(headerValue(response, 'cache-control')).to.match(/max-age=\d+/)
    expect(response.body).to.not.contain('og:video')
  })

  it('moves /photos/<id> to /videos/<id> when the id holds only a video', async () => {
    use(stubS3({ listing: videoListing() }))
    const response = await runHandler(photoHandler, `/photos/${VIDEO_ID}`)
    expect(response.status).to.equal('301')
    expect(headerValue(response, 'location')).to.equal(`https://wisaw.com/videos/${VIDEO_ID}`)
  })

  it('leaves a page alone when storage proves nothing about kind', async () => {
    // Redirecting on absence rather than on proof is how two routes start bouncing a crawler:
    // a thumb-only listing and an inconclusive S3 answer both render here instead.
    for (const listing of [videoListing().slice(1), s3Error('AccessDenied')]) {
      use(stubS3({ listing }))
      const response = await runHandler(videoHandler, `/videos/${VIDEO_ID}`)
      expect(response.status).to.equal('200')
      expect(headerValue(response, 'location'), JSON.stringify(listing)).to.equal(undefined)
    }
  })

  it('answers 404 for an id whose only object left is its sidecar', async () => {
    use(stubS3({ listing: [{ Key: `${PHOTO_ID}.json`, LastModified: dateOf(3) }] }))
    const response = await runHandler(photoHandler, `/photos/${PHOTO_ID}`)
    expect(response.status).to.equal('404')
    expect(headerValue(response, 'x-robots-tag')).to.contain('noindex')
  })

  it('keeps answering /photos/<id> for a video that has a still poster stored', async () => {
    // The redirect needs proof that nothing can be shown here. A video uploaded with its poster has
    // a full <id>.webp, so the photo URL really can render - and bouncing it would send crawlers
    // from one working page to another instead of fixing a broken one.
    use(stubS3({ listing: videoListing(VIDEO_ID, { withPoster: true }) }))
    const response = await runHandler(photoHandler, `/photos/${VIDEO_ID}`)
    expect(response.status).to.equal('200')
    expect(headerValue(response, 'location')).to.equal(undefined)
  })

  it('serves a video page whose object really is the stored extension', async () => {
    use(stubS3({ listing: videoListing(), sidecar: JSON.stringify({ v: 1, caption: 'Harbour at dusk' }) }))
    const response = await runHandler(videoHandler, `/videos/${VIDEO_ID}`)
    expect(response.status).to.equal('200')
    // The head names the object that exists, and its container type comes from that key.
    expect(response.body).to.contain(`https://img.wisaw.com/${VIDEO_ID}.mp4`)
    expect(response.body).to.contain('<meta property="og:video:type" content="video/mp4"')
  })
})

// The reader's cache is module-level and has no test hook, so each case below works on an id no
// earlier case touched. That is also how the cache behaves in production: per photo, per POP.
const CACHE_MISS_ID = 'b1000000-0000-4000-8000-000000000001'
const CACHE_DENIED_ID = 'b2000000-0000-4000-8000-000000000002'
const CACHE_RECOVER_ID = 'b3000000-0000-4000-8000-000000000003'

describe('the edge sidecar cache', () => {
  it('caches a sidecar that does not exist yet', async () => {
    const stub = use(stubS3({ sidecar: null }))
    expect(await fetchSidecar(CACHE_MISS_ID)).to.equal(null)
    expect(await fetchSidecar(CACHE_MISS_ID)).to.equal(null)
    const reads = stub.attempts.filter((a) => a.name === 'GetObjectCommand')
    expect(reads, 'fresh uploads are the common case; one read per POP per TTL').to.have.lengthOf(1)
  })

  it('does not cache a permission error as "no sidecar"', async () => {
    // One throttled or mis-permissioned answer used to blank this photo's title at that POP for ten
    // minutes, with nothing in the response to explain why. Uncached, the next request recovers.
    const stub = use(stubS3({ sidecar: s3Error('AccessDenied') }))
    expect(await fetchSidecar(CACHE_DENIED_ID)).to.equal(null)
    expect(stub.attempts.filter((a) => a.name === 'GetObjectCommand')).to.have.lengthOf(1)
    expect(await fetchSidecar(CACHE_DENIED_ID)).to.equal(null)
    expect(stub.attempts.filter((a) => a.name === 'GetObjectCommand'), 'retried, not cached').to.have.lengthOf(2)
  })

  it('reads a sidecar that appears after a failure', async () => {
    const failing = use(stubS3({ sidecar: s3Error('ThrottlingException') }))
    expect(await fetchSidecar(CACHE_RECOVER_ID)).to.equal(null)
    failing.restore()
    const working = use(stubS3({ sidecar: JSON.stringify({ v: 1, caption: 'Pier at dusk' }) }))
    const parsed = await fetchSidecar(CACHE_RECOVER_ID)
    expect(parsed && parsed.caption).to.equal('Pier at dusk')
    expect(working.attempts.filter((a) => a.name === 'GetObjectCommand')).to.have.lengthOf(1)
  })
})

describe('the coordinate guard is one rule, not two', () => {
  it('reads the writers own guard rather than restating it', () => {
    // sidecar.js used to keep a private copy of both; drift between them decides whether a
    // coordinate reaches a public page.
    expect(readerGuard).to.equal(writerGuard)
    expect(PRECISE_KEYS.length, 'the key list itself must be shared too').to.be.greaterThan(0)
  })

  it('still drops a stored coordinate from a legacy sidecar', async () => {
    const legacy = JSON.stringify({ v: 1, caption: 'Coney Island', location: 'POINT(-73.98 40.57)' })
    use(stubS3({ sidecar: legacy }))
    const parsed = await fetchSidecar('a0000001-0000-0000-0000-000000000001')
    expect(parsed.caption).to.equal('Coney Island')
    expect(parsed.location).to.equal(undefined)
  })
})
