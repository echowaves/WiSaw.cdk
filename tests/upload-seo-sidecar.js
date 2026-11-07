/* eslint-env node */
// ts-node's hook is load-bearing here, not decoration: processUploadedImage imports "../../psql"
// without an extension, which @babel/register and Node 24's own type stripping cannot resolve —
// same reason as in tests/photo-delete-cleanup.js, whose harness header this copies.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, after, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem, so seed the
// require cache with a stub before anything pulls in psql. Must happen before requiring the
// upload module. The after() hook below puts the cache back.
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

const sharp = require('sharp')
const { S3Client } = require('@aws-sdk/client-s3')
const { RekognitionClient } = require('@aws-sdk/client-rekognition')

const uploadModule = require('../lambda-fns/lambdas/processUploadedImage/index.ts')
const writeSeoSidecar = uploadModule._writeSeoSidecar
const main = uploadModule.main
const psql = require('../lambda-fns/psql.ts').default

const BUCKET = 'wisaw-img-test'
// The photo whose missing sidecar on prod (2026-11-07) opened this ticket. Uppercase here is a
// deliberate second check: the key contract lowercases, and sidecar readers only ever look for
// the lowercase form.
const ID_UPPER = '78250028-D951-4095-93B5-CD033A29514E'
const KEY = 'seo/78250028-d951-4095-93b5-cd033a29514e.json'

/** A full publisher-shaped row as the sidecar SELECT returns it (labels already aggregated). */
function photoRow (overrides = {}) {
  return {
    id: ID_UPPER,
    uuid: 'b1f0c9d2-0000-4aaa-8bbb-cd033a29514e',
    active: true,
    createdAt: new Date('2026-11-07T03:52:44Z'),
    lastComment: null,
    labels: ['Sunset', 'Beach', 'sunset'],
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

/** Captures console output so the "failed but logged, never thrown" rows can be asserted. */
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

describe('_writeSeoSidecar - upload-time sidecar writer', () => {
  let restores = []
  afterEach(() => { for (const f of restores) f(); restores = [] })

  // Console patches go through the tracked restore map (like the harnesses this copies), so a
  // failing assertion mid-test can never leave console.log/error monkey-patched for later tests.
  function watchConsole () {
    const out = captureConsole()
    restores.push(out.restore)
    return out
  }

  /** psql stub returning fixed rows; records which SQL ran, in order. */
  function stubPsql (rowsFor) {
    const log = []
    restores.push(patch(psql, 'connect', async () => { log.push('connect') }))
    restores.push(patch(psql, 'clean', async () => { log.push('clean') }))
    restores.push(patch(psql, 'query', async (sql) => {
      log.push(sql)
      return { rows: rowsFor ? rowsFor(sql) : [] }
    }))
    return log
  }

  /** S3 stub recording Put/Delete commands; can fail specific PUT keys. */
  function stubS3 (opts = {}) {
    const puts = []
    const deletes = []
    restores.push(patch(S3Client.prototype, 'send', async function (command) {
      const input = command.input ?? {}
      if (command.constructor.name === 'PutObjectCommand') {
        if ((opts.failKeys ?? []).includes(input.Key)) throw new Error('S3 boom')
        puts.push(input)
      }
      if (command.constructor.name === 'DeleteObjectCommand') deletes.push(input)
      return {}
    }))
    return {
      puts,
      byKey: (key) => puts.find(p => p.Key === key),
      keys: () => puts.map(p => p.Key),
      deleteKeys: () => deletes.map(d => d.Key)
    }
  }

  it('happy upload: PUTs seo/<lower-id>.json with the v1 body — labels and dimensions present, caption empty', async () => {
    stubPsql(() => [photoRow()])
    const s3 = stubS3()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    const put = s3.byKey(KEY)
    expect(put, 'sidecar PUT').to.be.an('object')
    expect(put.Bucket).to.equal(BUCKET)
    expect(put.ContentType).to.equal('application/json')
    expect(put.CacheControl).to.equal('max-age=60')
    const body = JSON.parse(put.Body)
    expect(body.v).to.equal(1)
    // Caption is legitimately empty at upload; the scheduled publisher refreshes it later.
    expect(body.caption).to.equal('')
    // pickLabels de-duplicates case-insensitively from the labels column _recognizeImage just wrote.
    expect(body.labels).to.deep.equal(['Sunset', 'Beach'])
    expect(body.created).to.equal('2026-11-07T03:52:44.000Z')
    expect(body.location).to.equal('Brooklyn, New York')
    // Dimensions come from the row _extractImageDimensions wrote in the same invocation.
    expect(body.width).to.equal('1200')
    expect(body.height).to.equal('800')
  })

  it('row gone or inactive (delete raced the upload): no PUT, resolves quietly', async () => {
    stubPsql(() => [])
    const s3 = stubS3()
    const out = watchConsole()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    expect(s3.keys()).to.deep.equal([])
    expect(out.text()).to.include('no active photo row')
  })

  it('S3 PUT fails: error logged and swallowed — the caller (and the upload) is unaffected', async () => {
    stubPsql(() => [photoRow()])
    stubS3({ failKeys: [KEY] })
    const out = watchConsole()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    expect(out.text()).to.include('Error writing SEO sidecar')
  })

  it('coordinate-looking location column: guard throws inside, swallowed — nothing is published', async () => {
    // The guard rejects a location that is nothing but coordinates (a bare "lat, lon" written
    // into the only populated address column); mixed place text passes by design.
    stubPsql(() => [photoRow({ locality: '40.6833, -73.9740', district: null, region: null })])
    const s3 = stubS3()
    const out = watchConsole()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    expect(s3.keys()).to.deep.equal([])
    expect(out.text()).to.include('Error writing SEO sidecar')
  })

  it('delete commits between the SELECT and the PUT: the resurrected sidecar is deleted again', async () => {
    // First (full-row) SELECT sees the photo; the post-write recheck already sees it gone.
    stubPsql((sql) => (/COALESCE/.test(sql) ? [photoRow()] : []))
    const s3 = stubS3()
    const out = watchConsole()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    expect(s3.keys(), 'sidecar was written').to.include(KEY)
    expect(s3.deleteKeys(), 'and removed again').to.include(KEY)
    expect(out.text()).to.include('resurrected by a racing delete')
  })

  it('psql read itself fails: swallowed like every other sidecar failure', async () => {
    restores.push(patch(psql, 'connect', async () => { throw new Error('db down') }))
    const s3 = stubS3()
    const out = watchConsole()

    await writeSeoSidecar({ Bucket: BUCKET, photoId: ID_UPPER })

    expect(s3.keys()).to.deep.equal([])
    expect(out.text()).to.include('Error writing SEO sidecar')
  })
})

describe('processUploadedImage main - sidecar end to end', () => {
  let restores = []
  afterEach(() => { for (const f of restores) f(); restores = [] })

  function watchConsole () {
    const out = captureConsole()
    restores.push(out.restore)
    return out
  }

  function event () {
    return {
      Records: [{
        s3: { bucket: { name: BUCKET }, object: { key: `${ID_UPPER}.upload` } }
      }]
    }
  }

  /** Full-pipeline stubs: real 1x1 image bytes, fake S3/Rekognition/psql with an ordered log. */
  async function stubPipeline (opts = {}) {
    // Real bytes through the real sharp path: _genWebp/_genWebpThumb/_extractImageDimensions all
    // parse this buffer, so a fixture sharp cannot read would test the stub, not the lambda.
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#123456' } }).png().toBuffer()
    const puts = []
    const dbLog = []

    restores.push(patch(S3Client.prototype, 'send', async function (command) {
      const input = command.input ?? {}
      if (command.constructor.name === 'GetObjectCommand') {
        return { Body: { transformToByteArray: async () => png } }
      }
      if (command.constructor.name === 'PutObjectCommand') {
        if (input.Key === KEY && opts.failSidecar) throw new Error('S3 boom')
        puts.push(input)
      }
      return {}
    }))
    // Rekognition is irrelevant here; fail fast so _recognizeImage takes its catch path.
    restores.push(patch(RekognitionClient.prototype, 'send', async () => { throw new Error('no rekognition in tests') }))

    restores.push(patch(psql, 'connect', async () => {}))
    restores.push(patch(psql, 'clean', async () => {}))
    restores.push(patch(psql, 'query', async (sql) => {
      // "set active = true" is the activate helper's SQL; the sidecar SELECT says p.active = true.
      if (/set active = true/i.test(sql)) dbLog.push('activate')
      if (/COALESCE\(r\."labels"/.test(sql)) dbLog.push('sidecar-select')
      if (/INSERT INTO "Recognitions"/.test(sql)) return { rows: [] }
      if (/SET width/.test(sql)) return { rows: [] }
      if (/set active = true/i.test(sql)) return { rows: [] }
      if (/COALESCE\(r\."labels"/.test(sql)) return { rows: opts.noRow ? [] : [photoRow()] }
      // Post-write recheck of the resurrection guard: the photo is still live in these runs.
      if (/SELECT "active" FROM "Photos"/.test(sql)) return { rows: [{ active: true }] }
      // The grouping block's uuid SELECT: empty rows skips autoGroupPhotosIntoWaves entirely.
      return { rows: [] }
    }))
    return { puts, dbLog, keys: () => puts.map(p => p.Key) }
  }

  it('a successful upload writes the sidecar — and only after the row was activated', async () => {
    const { keys, dbLog } = await stubPipeline()

    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(keys()).to.include(`${ID_UPPER}.webp`)
    expect(keys()).to.include(`${ID_UPPER}-thumb.webp`)
    expect(keys(), 'sidecar written at upload').to.include(KEY)
    // Ordering guard: the sidecar SELECT must run after the active=true UPDATE, or its
    // active filter would skip every fresh photo.
    expect(dbLog).to.deep.equal(['activate', 'sidecar-select'])
  })

  it('sidecar PUT fails: upload still completes and main() still returns true', async () => {
    const { keys } = await stubPipeline({ failSidecar: true })
    const out = watchConsole()

    const result = await main(event(), {})

    expect(result).to.equal(true)
    expect(keys()).to.include(`${ID_UPPER}-thumb.webp`)
    expect(keys()).to.not.include(KEY)
    expect(out.text()).to.include('Error writing SEO sidecar')
  })
})
