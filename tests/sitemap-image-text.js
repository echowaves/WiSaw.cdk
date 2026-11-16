/* eslint-env node */
// ts-node's hook is load-bearing: generateSiteMap imports "../../psql" without an extension, which
// @babel/register and Node 24's type stripping cannot resolve. Header copied from
// tests/upload-seo-sidecar.js for the same reason.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { beforeEach, describe, it, after, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem, so seed the
// require cache with a stub before anything pulls in psql.
const pemPath = path.resolve(__dirname, '../lambda-fns/certs/global-bundle.pem')
const pemWas = require.cache[pemPath]
if (pemWas === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

after(() => {
  if (pemWas === undefined) delete require.cache[pemPath]
  else require.cache[pemPath] = pemWas
})

const { S3Client } = require('@aws-sdk/client-s3')

const {
  splitImageText,
  IMAGE_TITLE_MAX,
  IMAGE_CAPTION_MAX
} = require('../lambda-fns/utilities/seoSidecar.ts')
const { main } = require('../lambda-fns/lambdas/generateSiteMap/index.ts')
const psql = require('../lambda-fns/psql.ts').default

const ID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'

/** Publisher-shaped row: labels already aggregated by the sitemap's SQL. */
function mediaRow (overrides = {}) {
  return {
    id: ID,
    active: true,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    lastComment: null,
    labels: [],
    locality: null,
    district: null,
    region: null,
    video: false,
    ...overrides
  }
}

describe('splitImageText - tags label, comment captions', () => {
  it('gives the title the tag list and the caption the comment when both exist', () => {
    const pair = splitImageText(mediaRow({ lastComment: 'A heron at dawn', labels: ['Heron', 'Wetland'] }), 'photo')
    expect(pair.title).to.equal('Heron, Wetland')
    expect(pair.caption).to.equal('A heron at dawn')
    expect(pair.title).to.not.equal(pair.caption)
  })

  it('lets the two slots agree only when there is no comment to caption with', () => {
    const pair = splitImageText(mediaRow({ labels: ['Heron'] }), 'photo')
    expect(pair.title).to.equal('Heron')
    expect(pair.caption).to.equal(pair.title)
  })

  it('titles a tag-less commented photo from place and month instead of repeating the comment', () => {
    const pair = splitImageText(mediaRow({ lastComment: 'A heron at dawn', locality: 'Krasnodar' }), 'photo')
    expect(pair.caption).to.equal('A heron at dawn')
    expect(pair.title).to.not.equal(pair.caption)
    expect(pair.title).to.equal('WiSaw photo — Krasnodar, Nov 2026')
  })

  it('keeps the identity fallback title so an un-enriched page is still unique', () => {
    const pair = splitImageText(mediaRow(), 'photo')
    expect(pair.title).to.equal('WiSaw photo — Nov 2026')
    // With no comment there is nothing to caption, so both slots carry that one text.
    expect(pair.caption).to.equal(pair.title)
    // Place and month unknown: the id carries the title so the page stays unique among 21k.
    expect(splitImageText(mediaRow({ createdAt: null }), 'video').title).to.equal(`WiSaw video ${ID}`)
  })

  it('titles with the first three tags, the same list og:image:title publishes', () => {
    const labels = ['Heron', 'Wetland', 'Dawn', 'Birds', 'River']
    const pair = splitImageText(mediaRow({ labels, lastComment: 'A heron at dawn' }), 'photo')
    expect(pair.title).to.equal('Heron, Wetland, Dawn')
    expect(pair.caption).to.equal('A heron at dawn')
  })

  it('cuts a long tag list at a word inside the title cap and keeps the comment whole', () => {
    const labels = ['golden retriever puppy playing outdoors', 'sunny late summer afternoon in the backyard', 'chasing a tennis ball']
    const pair = splitImageText(mediaRow({ labels, lastComment: 'Our dog on her favourite afternoon.' }), 'photo')
    expect(pair.title.length).to.be.at.most(IMAGE_TITLE_MAX)
    expect(pair.title.endsWith('…'), pair.title).to.equal(true)
    expect(pair.caption).to.equal('Our dog on her favourite afternoon.')
  })

  it('caps the caption at the image-caption limit while the title stays inside its own', () => {
    const comment = 'long '.repeat(200).trim()
    const pair = splitImageText(mediaRow({ lastComment: comment }), 'photo')
    expect(pair.caption.length).to.equal(IMAGE_CAPTION_MAX)
    expect(pair.title.length).to.be.at.most(IMAGE_TITLE_MAX)
  })
})

/**
 * Registers a configured media bucket for the enclosing describe. The job resolves its bucket from
 * the environment (utilities/seoSidecar.ts seoSidecarBucket) instead of a name baked into it, so a
 * run that leaves these unset behaves like a misconfigured stack: no sidecars, no video listing.
 */
function withConfiguredMediaBucket (name = 'wisaw-img-test') {
  const BUCKET_VARS = ['S3_IMAGES_BUCKET', 'WISAW_IMG_BUCKET', 'S3_BUCKET']
  let saved = {}
  beforeEach(() => {
    saved = {}
    for (const bucketVar of BUCKET_VARS) {
      saved[bucketVar] = process.env[bucketVar]
      delete process.env[bucketVar]
    }
    process.env.S3_BUCKET = name
  })
  afterEach(() => {
    for (const bucketVar of BUCKET_VARS) {
      if (saved[bucketVar] === undefined) delete process.env[bucketVar]
      else process.env[bucketVar] = saved[bucketVar]
    }
  })
}

describe('generateSiteMap - two texts in the emitted XML', () => {
  const originals = { connect: psql.connect, query: psql.query, clean: psql.clean }
  const sendWas = S3Client.prototype.send

  afterEach(() => {
    psql.connect = originals.connect
    psql.query = originals.query
    psql.clean = originals.clean
    S3Client.prototype.send = sendWas
  })

  /** Runs main() over fixed rows and returns the sitemap.xml body that would have been uploaded. */
  async function publish (rows) {
    const puts = []
    psql.connect = async () => {}
    psql.clean = async () => {}
    psql.query = async (sql) => ({ rows: /FROM "Photos"/i.test(sql) ? rows : [] })
    S3Client.prototype.send = async function (cmd) {
      puts.push(cmd)
      return {}
    }

    const ok = await main({})
    expect(ok, 'main() aborted before publishing').to.equal(true)

    const sitemapPut = puts.find((cmd) => cmd.input?.Key === 'sitemap.xml')
    expect(sitemapPut, 'no sitemap.xml PUT').to.not.equal(undefined)
    return String(sitemapPut.input.Body)
  }

  it('publishes distinct image title and caption for a commented photo', async () => {
    const xml = await publish([
      mediaRow({ id: 'a'.repeat(36), lastComment: 'A heron at dawn', labels: ['Heron', 'Wetland'] }),
      mediaRow({ id: 'b'.repeat(36), labels: ['Sunset'] })
    ])
    // One <url> block per photo; the library writes caption before title, so read a block rather
    // than assuming an order.
    const blocks = xml.split('<url>')
    const commented = blocks.find((block) => block.includes(`/photos/${'a'.repeat(36)}`))
    const plain = blocks.find((block) => block.includes(`/photos/${'b'.repeat(36)}`))

    expect(commented).to.include('<image:title>Heron, Wetland</image:title>')
    expect(commented).to.include('<image:caption>A heron at dawn</image:caption>')
    // The comment-less photo keeps the old equality - there is nothing else to say about it.
    expect(plain).to.include('<image:title>Sunset</image:title>')
    expect(plain).to.include('<image:caption>Sunset</image:caption>')
  })

  it('titles a video with its tags and describes it with the comment', async () => {
    const xml = await publish([
      mediaRow({ id: 'c'.repeat(36), video: true, lastComment: 'Shot at dawn', labels: ['Heron'] }),
      mediaRow({ id: 'd'.repeat(36), video: true, labels: ['Heron'] })
    ])
    const blocks = xml.split('<url>')
    const commented = blocks.find((block) => block.includes(`/videos/${'c'.repeat(36)}`))
    const plain = blocks.find((block) => block.includes(`/videos/${'d'.repeat(36)}`))

    expect(commented).to.include('<video:title>Heron</video:title>')
    expect(commented).to.include('<video:description>Shot at dawn</video:description>')
    // No comment means nothing to caption, so the description carries the title's text.
    expect(plain).to.include('<video:description>Heron</video:description>')
  })
})

describe('generateSiteMap - the video file a sitemap entry names', () => {
  const originals = { connect: psql.connect, query: psql.query, clean: psql.clean }
  const sendWas = S3Client.prototype.send
  withConfiguredMediaBucket()

  afterEach(() => {
    psql.connect = originals.connect
    psql.query = originals.query
    psql.clean = originals.clean
    S3Client.prototype.send = sendWas
  })

  /**
   * Runs main() over fixed rows against a bucket that holds `storedKeys`.
   * `failListing` simulates the listing itself being unavailable (permissions, throttling).
   */
  async function publishStored (rows, storedKeys, { failListing = false } = {}) {
    const puts = []
    psql.connect = async () => {}
    psql.clean = async () => {}
    psql.query = async (sql) => ({ rows: /FROM "Photos"/i.test(sql) ? rows : [] })
    S3Client.prototype.send = async function (cmd) {
      const name = cmd?.constructor?.name ?? ''
      if (name === 'ListObjectsV2Command' || String(cmd?.input?.MaxKeys) === '1000') {
        if (failListing) throw new Error('AccessDenied')
        return { Contents: storedKeys.map((Key) => ({ Key })), IsTruncated: false }
      }
      puts.push(cmd)
      return {}
    }

    const ok = await main({})
    expect(ok, 'main() aborted before publishing').to.equal(true)
    const sitemapPut = puts.find((cmd) => cmd.input?.Key === 'sitemap.xml')
    expect(sitemapPut, 'no sitemap.xml PUT').to.not.equal(undefined)
    return String(sitemapPut.input.Body)
  }

  it('names the stored object when a video is not a .mov', async () => {
    const id = 'e'.repeat(36)
    const xml = await publishStored(
      [mediaRow({ id, video: true, labels: ['Heron'] })],
      [`${id}.mp4`, `${id}-thumb.webp`]
    )
    expect(xml).to.include(`<video:content_loc>https://img.wisaw.com/${id}.mp4</video:content_loc>`)
    expect(xml).to.not.include(`${id}.mov`)
  })

  it('names the .mov object that exists, and falls back to it when storage has nothing', async () => {
    const known = 'f'.repeat(36)
    const missing = '0'.repeat(36)
    const xml = await publishStored(
      [mediaRow({ id: known, video: true, labels: ['Heron'] }), mediaRow({ id: missing, video: true, labels: ['Heron'] })],
      [`${known}.mov`]
    )
    expect(xml).to.include(`<video:content_loc>https://img.wisaw.com/${known}.mov</video:content_loc>`)
    // An id storage never reported is still published — a missing lookup must not drop a page,
    // and the naming rule's documented extension keeps the URL well-formed.
    expect(xml).to.include(`<video:content_loc>https://img.wisaw.com/${missing}.mov</video:content_loc>`)
  })

  it('publishes photo image and video thumbnail URLs unchanged', async () => {
    const photoId = '1'.repeat(36)
    const videoId = '2'.repeat(36)
    const xml = await publishStored(
      [mediaRow({ id: photoId, labels: ['Heron'] }), mediaRow({ id: videoId, video: true, labels: ['Heron'] })],
      [`${videoId}.mov`]
    )
    expect(xml).to.include(`<image:loc>https://img.wisaw.com/${photoId}.webp</image:loc>`)
    expect(xml).to.include(`<video:thumbnail_loc>https://img.wisaw.com/${videoId}-thumb.webp</video:thumbnail_loc>`)
  })

  it('still publishes the sitemap when the listing is unavailable', async () => {
    const id = '3'.repeat(36)
    const xml = await publishStored([mediaRow({ id, video: true, labels: ['Heron'] })], [], { failListing: true })
    expect(xml).to.include(`/videos/${id}`)
    expect(xml).to.include(`<video:content_loc>https://img.wisaw.com/${id}.mov</video:content_loc>`)
  })
})

describe('generateSiteMap - the sidecars this job is the only writer of', () => {
  const originals = { connect: psql.connect, query: psql.query, clean: psql.clean }
  const sendWas = S3Client.prototype.send
  // The bucket now comes from the shared resolver, so a run has to be configured like a real one.
  const BUCKET_VARS = ['S3_IMAGES_BUCKET', 'WISAW_IMG_BUCKET', 'S3_BUCKET']
  let envWas = {}

  beforeEach(() => {
    envWas = {}
    for (const name of BUCKET_VARS) {
      envWas[name] = process.env[name]
      delete process.env[name]
    }
    process.env.S3_BUCKET = 'wisaw-img-test'
  })

  afterEach(() => {
    psql.connect = originals.connect
    psql.query = originals.query
    psql.clean = originals.clean
    S3Client.prototype.send = sendWas
    for (const name of BUCKET_VARS) {
      if (envWas[name] === undefined) delete process.env[name]
      else process.env[name] = envWas[name]
    }
  })

  /** Runs main() over fixed rows and returns every object it would have PUT. */
  async function published (rows, event = {}) {
    const puts = []
    psql.connect = async () => {}
    psql.clean = async () => {}
    psql.query = async (sql) => ({ rows: /FROM "Photos"/i.test(sql) ? rows : [] })
    S3Client.prototype.send = async function (cmd) {
      const name = cmd?.constructor?.name ?? ''
      if (name === 'ListObjectsV2Command' || String(cmd?.input?.MaxKeys) === '1000') {
        return { Contents: [], IsTruncated: false }
      }
      puts.push(cmd)
      return {}
    }

    expect(await main(event), 'main() aborted before publishing').to.equal(true)
    // PUTs only: the run also GETs its own watermark object, which shares the .json suffix.
    return puts
      .filter((cmd) => cmd?.constructor?.name === 'PutObjectCommand' && String(cmd.input?.Key).endsWith('.json'))
      .map((cmd) => cmd.input)
  }

  /** The job writes its own state object too; the assertions below are about media sidecars. */
  function sidecarKeys (inputs) {
    return inputs.filter((input) => input.Key !== 'seo/_last-run.json').map((input) => input.Key)
  }

  it('PUTs one <lower-id>.json per recently touched row into the configured bucket', async () => {
    const lower = '4'.repeat(35) + 'A'
    const inputs = await published([
      mediaRow({ id: lower, updatedAt: new Date().toISOString(), lastComment: 'A heron at dawn' })
    ])

    // The key is lower-cased by the writer's own helper: an uppercase id would otherwise publish
    // beside the object the edge asks for and leave the page with no text to render.
    expect(sidecarKeys(inputs)).to.deep.equal([`${lower.toLowerCase()}.json`])
    expect(inputs[0].Bucket).to.equal('wisaw-img-test')
    expect(inputs[0].ContentType).to.equal('application/json')
    expect(inputs[0].CacheControl).to.equal('max-age=60')
    // What the edge actually reads, not just where it was put.
    const body = JSON.parse(String(inputs[0].Body))
    // Composed by the live writers' own rules, so the comment captions it and the capture date is
    // appended - what matters here is that the edge gets the same text an upload would publish.
    expect(body.seo.description).to.include('A heron at dawn')
    expect(body.seo.kind).to.equal('photo')
  })

  it('leaves rows outside the touch window alone and advances the watermark once every write landed', async () => {
    const fresh = '5'.repeat(36)
    const stale = '6'.repeat(36)
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const inputs = await published([
      mediaRow({ id: fresh, updatedAt: new Date().toISOString() }),
      mediaRow({ id: stale, updatedAt: longAgo })
    ])

    expect(sidecarKeys(inputs)).to.deep.equal([`${fresh}.json`])
    // The watermark is what makes the next run's window start here instead of guessing a lookback.
    const watermark = inputs.find((input) => input.Key === 'seo/_last-run.json')
    expect(watermark, 'watermark not written after an all-succeeded run').to.not.equal(undefined)
  })

  it('publishes a sidecar for every row when asked to backfill', async () => {
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const inputs = await published([mediaRow({ id: '7'.repeat(36), updatedAt: longAgo })], { backfill: true })
    expect(sidecarKeys(inputs)).to.deep.equal([`${'7'.repeat(36)}.json`])
  })

  it('still publishes the sitemap when no media bucket is configured, and writes no sidecars', async () => {
    delete process.env.S3_BUCKET
    const puts = []
    psql.connect = async () => {}
    psql.clean = async () => {}
    psql.query = async (sql) => ({ rows: /FROM "Photos"/i.test(sql) ? [mediaRow({ id: '8'.repeat(36), updatedAt: new Date().toISOString() })] : [] })
    S3Client.prototype.send = async function (cmd) {
      const name = cmd?.constructor?.name ?? ''
      if (name === 'ListObjectsV2Command' || String(cmd?.input?.MaxKeys) === '1000') return { Contents: [], IsTruncated: false }
      puts.push(cmd)
      return {}
    }

    expect(await main({}), 'an unconfigured bucket must not cost the site its sitemap').to.equal(true)
    expect(puts.some((cmd) => cmd?.input?.Key === 'sitemap.xml'), 'no sitemap.xml PUT').to.equal(true)
    expect(puts.filter((cmd) => String(cmd?.input?.Key).endsWith('.json'))).to.deep.equal([])
  })
})
