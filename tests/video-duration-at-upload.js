/* eslint-env node */
/* global require, describe, it, Buffer, BigInt */

// seo-indexing/9: a video's length must be learned while its upload is being processed, so the
// first enrichment record published for a brand-new video already states it — instead of waiting
// for a comment, the bounded scheduled pass, or an operator running the backfill.
//
// The fixtures are hand-built QuickTime boxes (same as tests/video-duration.js) because what is
// under test is where the number comes from: the stored video object for this media id, never the
// bytes that triggered processing — which here are deliberately a still poster image.

// ts-node's hook is load-bearing: processUploadedImage imports "../../psql" without an extension.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem.
const pemPath = path.resolve(__dirname, '../lambda-fns/certs/global-bundle.pem')
if (require.cache[pemPath] === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

const sharp = require('sharp')
const { S3Client } = require('@aws-sdk/client-s3')
const { RekognitionClient } = require('@aws-sdk/client-rekognition')

const uploadModule = require('../lambda-fns/lambdas/processUploadedImage/index.ts')
const psql = require('../lambda-fns/psql.ts').default

const main = uploadModule.main
const learnVideoDuration = uploadModule._learnVideoDuration

const BUCKET = 'wisaw-img-test'
const ID_UPPER = '9BE1F3A4-2C67-4E0B-9D5A-1F2E3D4C5B6A'
const ID_LOWER = ID_UPPER.toLowerCase()
const VIDEO_KEY = `${ID_LOWER}.mov`
const SIDECAR_KEY = `${ID_LOWER}.json`

/** A 48-second recording: mvhd says 48750 ticks at a 1000 Hz timescale. */
function movBytes () {
  const boxOf = (type, payload) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(8 + payload.length, 0)
    Buffer.from(type, 'latin1').copy(head, 4)
    return Buffer.concat([head, payload])
  }
  const body = Buffer.alloc(20)
  body[0] = 0
  body.writeUInt32BE(1000, 12)
  body.writeInt32BE(48750, 16)
  return Buffer.concat([
    boxOf('ftyp', Buffer.alloc(24)),
    boxOf('moov', boxOf('mvhd', body))
  ])
}

/** A publisher-shaped row as the sidecar SELECT returns it; `video`/`duration` drive the probe. */
function photoRow (state, overrides = {}) {
  return {
    id: ID_UPPER,
    uuid: 'b1f0c9d2-0000-4aaa-8bbb-cd033a29514e',
    active: true,
    video: state.video,
    duration: state.duration,
    createdAt: new Date('2026-11-11T03:52:44Z'),
    lastComment: null,
    labels: ['Sunset'],
    width: 1200,
    height: 800,
    locality: 'Brooklyn',
    district: null,
    region: 'New York',
    ...overrides
  }
}

function patch (obj, name, value) {
  const orig = obj[name]
  obj[name] = value
  return () => { obj[name] = orig }
}

function captureConsole () {
  const lines = []
  const origLog = console.log
  const origError = console.error
  console.log = (...args) => { lines.push(args) }
  console.error = (...args) => { lines.push(args) }
  return {
    text: () => lines.flat().map(entry => {
      if (entry instanceof Error) return entry.message
      if (typeof entry === 'string') return entry
      const unwrap = (_key, value) => (value instanceof Error ? value.message : value)
      try { return JSON.stringify(entry, unwrap) } catch (_err) { return String(entry) }
    }).join('\n'),
    restore () {
      console.log = origLog
      console.error = origError
    }
  }
}

/**
 * Full upload pipeline: the real sharp path over a still-image poster, a stored .mov that answers
 * with its container, and a psql stub whose sidecar SELECT reflects what has been written so far —
 * so a duration only reaches the published record if it was stored before the record was read.
 */
async function stubPipeline (opts = {}) {
  const state = { video: opts.video ?? true, duration: opts.duration ?? null }
  const mov = opts.unmeasurable ? Buffer.alloc(512) : movBytes()
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#123456' } }).png().toBuffer()

  const puts = []
  const dbLog = []
  const s3log = []

  restores.push(patch(S3Client.prototype, 'send', async function (command) {
    const input = command.input ?? {}
    const name = command.constructor.name
    s3log.push({ name, key: input.Key, range: input.Range })

    if (name === 'GetObjectCommand') {
      // The upload event carries a still poster; only ranged reads may touch the video object.
      if (input.Range != null) {
        if (opts.failRange) throw new Error('s3 range boom')
        const [from, to] = String(input.Range).replace('bytes=', '').split('-').map(Number)
        const slice = mov.subarray(from, Math.min(to + 1, mov.length))
        return { Body: { transformToByteArray: async () => slice } }
      }
      if (opts.failPosterGet) throw new Error('s3 get boom')
      return { Body: { transformToByteArray: async () => png } }
    }
    if (name === 'HeadObjectCommand') {
      if (opts.failHead) throw new Error('s3 head boom')
      return { ContentLength: mov.length }
    }
    if (name === 'ListObjectsV2Command') {
      return { Contents: [{ Key: VIDEO_KEY }] }
    }
    if (name === 'PutObjectCommand') {
      if (input.Key === SIDECAR_KEY && opts.failSidecar) throw new Error('S3 boom')
      puts.push(input)
    }
    return {}
  }))
  restores.push(patch(RekognitionClient.prototype, 'send', async () => { throw new Error('no rekognition in tests') }))

  restores.push(patch(psql, 'connect', async () => {}))
  restores.push(patch(psql, 'clean', async () => {}))
  restores.push(patch(psql, 'query', async (sql, values) => {
    if (/set active = true/i.test(sql)) { dbLog.push('activate'); return { rows: [] } }
    if (/SET width/.test(sql)) return { rows: [] }
    if (/INSERT INTO "Recognitions"/.test(sql)) return { rows: [] }
    // The upload processor's narrow probe-gate read.
    if (/SELECT "id", "video", "duration" FROM "Photos"/.test(sql)) {
      dbLog.push('probe-gate')
      if (opts.failGate) throw new Error('db down')
      return { rows: [{ id: ID_UPPER, video: state.video, duration: state.duration }] }
    }
    if (/SET "duration" =/i.test(sql)) {
      dbLog.push('duration-update')
      state.duration = Number(values[1])
      return { rows: [] }
    }
    if (/COALESCE\(r\."labels"/.test(sql)) { dbLog.push('sidecar-select'); return { rows: [photoRow(state)] } }
    if (/SELECT "active" FROM "Photos"/.test(sql)) return { rows: [{ active: true }] }
    return { rows: [] }
  }))

  const sidecar = () => {
    const put = puts.find((p) => p.Key === SIDECAR_KEY)
    return put == null ? null : JSON.parse(put.Body)
  }
  return {
    puts,
    dbLog,
    s3log,
    keys: () => puts.map((p) => p.Key),
    sidecar,
    state,
    askedStorage: () => s3log.some((e) => e.name === 'ListObjectsV2Command' || e.name === 'HeadObjectCommand')
  }
}

let restores = []

function event () {
  return { Records: [{ s3: { bucket: { name: BUCKET }, object: { key: `${ID_UPPER}.upload` } } }] }
}

describe('video duration during upload processing (seo-indexing/9)', () => {
  afterEach(() => { for (const f of restores) f(); restores = [] })

  it('a new video is measured from its stored object and the record published by the same run states it', async () => {
    const run = await stubPipeline()
    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(run.dbLog, 'the row was measured').to.include('duration-update')
    // Ordering is the whole point: stored before the record read it, or the page waits again.
    expect(run.dbLog.indexOf('duration-update')).to.be.below(run.dbLog.indexOf('sidecar-select'))
    expect(run.sidecar().duration).to.equal(48)
  })

  it('the length comes from the stored video object, never from the bytes that triggered processing', async () => {
    const run = await stubPipeline()
    await main(event(), {})

    const ranged = run.s3log.filter((e) => e.name === 'GetObjectCommand' && e.range != null)
    expect(ranged.length, 'the container was read in bounded windows').to.be.above(0)
    expect([...new Set(ranged.map((e) => e.key))], 'and only the stored video object').to.deep.equal([VIDEO_KEY])
    expect(run.sidecar().duration).to.equal(48)
  })

  it('an image upload asks storage nothing and its record stays exactly as it is today', async () => {
    const run = await stubPipeline({ video: false })

    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(run.askedStorage(), 'no listing, no HEAD for an image').to.equal(false)
    expect(run.dbLog).to.not.include('duration-update')
    expect(run.keys()).to.include(`${ID_UPPER}-thumb.webp`)
    expect(Object.prototype.hasOwnProperty.call(run.sidecar(), 'duration'), 'no duration key at all').to.equal(false)
  })

  it('a row that already states a length is never probed again', async () => {
    const run = await stubPipeline({ duration: 12 })

    await main(event(), {})

    expect(run.askedStorage(), 'no second opinion, no repeat cost').to.equal(false)
    expect(run.dbLog).to.not.include('duration-update')
    expect(run.sidecar().duration).to.equal(12)
  })

  it('a container that does not say: nothing is stored and the record states no duration', async () => {
    const run = await stubPipeline({ unmeasurable: true })

    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(run.dbLog).to.not.include('duration-update')
    expect(Object.prototype.hasOwnProperty.call(run.sidecar(), 'duration'), 'never 0, never a guess').to.equal(false)
  })

  it('the step failing cannot change the upload: thumb, activation and record all still happen', async () => {
    const run = await stubPipeline({ failGate: true })
    const out = captureConsole()
    restores.push(out.restore)

    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(run.keys()).to.include(`${ID_UPPER}-thumb.webp`)
    expect(run.dbLog).to.include('activate')
    expect(run.dbLog, 'the record was still written').to.include('sidecar-select')
    expect(Object.prototype.hasOwnProperty.call(run.sidecar(), 'duration')).to.equal(false)
    expect(out.text()).to.include('Error learning video duration at upload')
  })

  it('_learnVideoDuration is a no-op for a media id with no row', async () => {
    restores.push(patch(psql, 'connect', async () => {}))
    restores.push(patch(psql, 'clean', async () => {}))
    restores.push(patch(psql, 'query', async (sql) => {
      if (/SELECT "id", "video", "duration" FROM "Photos"/.test(sql)) return { rows: [] }
      throw new Error(`unexpected SQL for a missing row: ${sql}`)
    }))
    restores.push(patch(S3Client.prototype, 'send', async function (command) {
      throw new Error(`${command.constructor.name} must not be called`)
    }))

    await learnVideoDuration({ Bucket: BUCKET, photoId: ID_UPPER })
  })
})
