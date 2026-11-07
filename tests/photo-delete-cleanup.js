/* eslint-env node */
// ts-node's hook is load-bearing here, not decoration: delete.ts imports "../../psql" without an
// extension, which @babel/register and Node 24's own type stripping cannot resolve — same reason
// as in tests/seo-sidecar-lifecycle.js, whose harness header this copies.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, after, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem, so seed the
// require cache with a stub before anything pulls in psql (the same trick ts-node's pem.d.ts plays
// at build time). Must happen before requiring delete.ts. The root hook below puts the cache back
// so no test file loaded after this one inherits a fake CA.
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
const { CloudFrontClient } = require('@aws-sdk/client-cloudfront')
const deleteModule = require('../lambda-fns/controllers/photos/delete.ts')
const deletePhoto = deleteModule.default
const photoObjectKeys = deleteModule.photoObjectKeys
const cleanupPhotoObjects = deleteModule.cleanupPhotoObjects

const BUCKET = 'wisaw-img-test'
const DISTRO = 'E275CUZVESLWC7'
const LIVE = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const UPPER = '35E99E0C-03A1-4F30-80D3-405BC1F3DF35'
const CALLER = '8f2a1111-2222-4333-8444-555566667777'
// Shares its first 8 hex chars with LIVE and differs only in the last character: the closest legal
// sibling there is, so it is a real prefix-collision candidate rather than a decorative second id.
const SIBLING = '35e99e0c-03a1-4f30-80d3-405bc1f3df36'

const MEDIA_KEYS = [`${LIVE}.webp`, `${LIVE}-thumb.webp`, `${LIVE}.mov`]
const FOUR_KEYS = [...MEDIA_KEYS, `seo/${LIVE}.json`]
const FOUR_PATHS = [`/${LIVE}.webp*`, `/${LIVE}-thumb.webp*`, `/${LIVE}.mov*`, `/seo/${LIVE}.json*`]

/** Duck-typed S3Client: records commands and can be told to fail for specific keys. */
function fakeS3 (opts = {}) {
  const sent = []
  return {
    sent,
    keys: () => sent.map(c => c.input.Key),
    async send (command) {
      sent.push(command)
      const key = String(command.input?.Key ?? '')
      if (Array.isArray(opts.fail) && opts.fail.includes(key)) throw new Error('S3 boom')
      return {}
    }
  }
}

function fakeCf () {
  const sent = []
  return {
    sent,
    paths: () => sent.flatMap(c => c.input?.InvalidationBatch?.Paths?.Items ?? []),
    async send (command) {
      sent.push(command)
      return { Invalidations: { Id: 'I123' } }
    }
  }
}

/** Captures console output so the "failed but logged, never thrown" rows can be asserted. */
function captureConsole () {
  const lines = []
  const origLog = console.log
  const origError = console.error
  const origWarn = console.warn
  console.log = (...args) => { lines.push(args) }
  console.error = (...args) => { lines.push(args) }
  console.warn = (...args) => { lines.push(args) }
  return {
    lines,
    text: () => lines.flat().map(entry => {
      if (entry instanceof Error) return entry.message
      if (typeof entry === 'string') return entry
      // Errors nested in logged objects ({ err }) would stringify to {}, so unwrap them.
      const unwrap = (_key, value) => (value instanceof Error ? value.message : value)
      try { return JSON.stringify(entry, unwrap) } catch (_err) { return String(entry) }
    }).join('\n'),
    restore () {
      console.log = origLog
      console.error = origError
      console.warn = origWarn
    }
  }
}

describe('photoObjectKeys - key contract', () => {
  it('derives exactly the three media shapes a photo id can own (original, thumb, video)', () => {
    expect(photoObjectKeys(LIVE)).to.deep.equal(MEDIA_KEYS)
  })

  it('normalizes an uppercase id to the lowercase bucket convention', () => {
    expect(photoObjectKeys(UPPER)).to.deep.equal(MEDIA_KEYS)
  })

  it('deletes exact keys only - no prefix or wildcard shapes ever enter the delete set', () => {
    for (const key of photoObjectKeys(LIVE)) {
      expect(key).to.not.include('*')
      // Every derived key is a complete filename, not a bare id that would sweep siblings sharing
      // its prefix: each one ends in the id plus an extension.
      expect(key.endsWith('.webp') || key.endsWith('.mov')).to.equal(true)
    }
  })
})

describe('cleanupPhotoObjects - storage and CDN steps', () => {
  it('deletes the original, thumb, video and seo sidecar - exact keys, nothing else', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()

    await cleanupPhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(s3.sent.every(c => c.input.Bucket === BUCKET)).to.equal(true)
    // The sibling photo sharing the id prefix is untouched: no sent key could match it.
    for (const shape of [`${SIBLING}.webp`, `${SIBLING}-thumb.webp`, `${SIBLING}.mov`]) {
      expect(s3.keys()).to.not.include(shape)
    }
    expect(s3.keys().some(k => k === LIVE || k === `${LIVE}/`)).to.equal(false)
  })

  it('issues one wildcard invalidation covering all four public paths', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()

    await cleanupPhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(cf.sent).to.have.lengthOf(1)
    expect(cf.sent[0].constructor.name).to.equal('CreateInvalidationCommand')
    expect(cf.sent[0].input.DistributionId).to.equal(DISTRO)
    expect(cf.paths()).to.have.members(FOUR_PATHS)
  })

  it('normalizes an uppercase id before touching storage', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()

    await cleanupPhotoObjects(UPPER, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(cf.paths()).to.have.members(FOUR_PATHS)
  })

  it('skips the invalidation when no distribution is configured but still deletes', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()

    await cleanupPhotoObjects(LIVE, { bucket: BUCKET, distributionId: '', s3, cloudfront: cf })

    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(cf.sent).to.deep.equal([])
  })

  it('does nothing at all when no media bucket is configured', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()
    const logs = captureConsole()

    try {
      await cleanupPhotoObjects(LIVE, { bucket: '', distributionId: DISTRO, s3, cloudfront: cf })
    } finally {
      logs.restore()
    }

    expect(s3.sent).to.deep.equal([])
    expect(cf.sent).to.deep.equal([])
    expect(logs.text()).to.include('no media bucket configured')
  })

  it('keeps deleting the remaining keys when one storage call fails, and still invalidates', async () => {
    const s3 = fakeS3({ fail: [`${LIVE}.mov`] })
    const cf = fakeCf()
    const logs = captureConsole()

    try {
      await cleanupPhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })
    } finally {
      logs.restore()
    }

    // The failed key is attempted (and logged); the other three still go through.
    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(logs.text()).to.include('S3 boom')
    expect(cf.sent).to.have.lengthOf(1)
  })

  it('swallows and logs a CloudFront failure', async () => {
    const s3 = fakeS3()
    const logs = captureConsole()
    const cf = {
      sent: [],
      async send () { throw new Error('CloudFront boom') }
    }

    try {
      await cleanupPhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })
    } finally {
      logs.restore()
    }

    expect(logs.text()).to.include('CloudFront boom')
  })
})

describe('deletePhoto - cleanup rides the existing procedure', () => {
  const originals = new Map()
  const envBackup = new Map()

  const patch = (obj, name, value) => {
    if (!originals.has(`${obj.constructor.name}.${name}`)) {
      originals.set(`${obj.constructor.name}.${name}`, { obj, name, value: obj[name] })
    }
    obj[name] = value
  }

  const setEnv = (name, value) => {
    if (!envBackup.has(name)) envBackup.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  afterEach(() => {
    for (const { obj, name, value } of originals.values()) obj[name] = value
    originals.clear()
    for (const [name, value] of envBackup.entries()) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    envBackup.clear()
  })

  function stubPsql (log) {
    const psql = require('../lambda-fns/psql.ts').default
    patch(psql, 'connect', async () => { log.push('psql.connect') })
    patch(psql, 'query', async () => { log.push('psql.query'); return { rows: [] } })
    patch(psql, 'clean', async () => { log.push('psql.clean') })
  }

  function stubStorage (log, s3Behaviour = {}) {
    const calls = { s3: [], cf: [] }
    patch(S3Client.prototype, 'send', async function (command) {
      log.push(`s3:${command.constructor.name}`)
      calls.s3.push(command)
      if (s3Behaviour.fail) throw new Error('S3 boom')
      return {}
    })
    patch(CloudFrontClient.prototype, 'send', async function (command) {
      log.push(`cf:${command.constructor.name}`)
      calls.cf.push(command)
      return {}
    })
    return calls
  }

  it('always cleans up after the soft delete - no env flag needed - and returns OK', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', undefined)
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', DISTRO)

    const log = []
    stubPsql(log)
    const calls = stubStorage(log)

    const result = await deletePhoto(LIVE, CALLER)

    expect(result).to.equal('OK')
    expect(log.filter(l => l.startsWith('psql.query'))).to.have.lengthOf.above(0)
    expect(calls.s3.map(c => c.input.Key)).to.have.members(FOUR_KEYS)
    expect(calls.s3.every(c => c.input.Bucket === BUCKET)).to.equal(true)
    expect(calls.cf).to.have.lengthOf(1)
    expect(calls.cf[0].input.InvalidationBatch.Paths.Items).to.have.members(FOUR_PATHS)
    // Cleanup rides after the DB work: it must never run before the soft delete is committed.
    const firstStorage = log.findIndex(l => l.startsWith('s3:') || l.startsWith('cf:'))
    expect(log.indexOf('psql.clean')).to.be.at.least(0)
    expect(firstStorage).to.be.greaterThan(log.indexOf('psql.clean'))
  })

  it('skips only the invalidation when this environment has no distribution id', async () => {
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', '')

    const log = []
    stubPsql(log)
    const calls = stubStorage(log)

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(calls.s3.map(c => c.input.Key)).to.have.members(FOUR_KEYS)
    expect(calls.cf).to.deep.equal([])
  })

  it('storage failures never surface as an AppSync error: the mutation still returns OK', async () => {
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', DISTRO)

    const log = []
    stubPsql(log)
    const calls = stubStorage(log, { fail: true })
    const logs = captureConsole()

    let result
    try {
      result = await deletePhoto(LIVE, CALLER)
    } finally {
      logs.restore()
    }

    expect(result).to.equal('OK')
    expect(calls.s3.map(c => c.input.Key)).to.have.members(FOUR_KEYS)
    expect(logs.text()).to.include('S3 boom')
  })
})
