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
const { sidecarKey } = require('../lambda-fns/utilities/seoSidecar.ts')
const { photoObjectKeys, invalidationPaths, removePhotoObjects } = require('../lambda-fns/utilities/photoCleanup.ts')
const deleteModule = require('../lambda-fns/controllers/photos/delete.ts')
const deletePhoto = deleteModule.default
const isCleanupEnabled = deleteModule.isCleanupEnabled

const BUCKET = 'wisaw-img-test'
const DISTRO = 'E275CUZVESLWC7'
const LIVE = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const UPPER = '35E99E0C-03A1-4F30-80D3-405BC1F3DF35'
const CALLER = '8f2a1111-2222-4333-8444-555566667777'
// Shares its first 8 hex chars with LIVE and differs only in the last character: the closest legal
// sibling there is, so it is a real prefix-collision candidate rather than a decorative second id.
const SIBLING = '35e99e0c-03a1-4f30-80d3-405bc1f3df36'

const FOUR_KEYS = [`${LIVE}.webp`, `${LIVE}-thumb.webp`, `${LIVE}.mov`, `seo/${LIVE}.json`]
const FOUR_PATHS = [`/${LIVE}.webp*`, `/${LIVE}-thumb.webp*`, `/${LIVE}.mov*`, `/seo/${LIVE}.json*`]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Duck-typed S3Client: records commands and can be told to be slow, hang forever, answer
 * NoSuchKey for some keys, or fail outright for others.
 */
function fakeS3 (opts = {}) {
  const sent = []
  return {
    sent,
    keys: () => sent.map(c => c.input.Key),
    async send (command) {
      sent.push(command)
      const key = String(command.input?.Key ?? '')
      if (opts.hang || (typeof opts.hangAfter === 'number' && sent.length > opts.hangAfter)) {
        return await new Promise(() => {})
      }
      if (typeof opts.delayMs === 'number') await sleep(opts.delayMs)
      if (Array.isArray(opts.noSuchKey) && opts.noSuchKey.includes(key)) {
        const err = new Error('The specified key does not exist.')
        err.name = 'NoSuchKey'
        throw err
      }
      if (Array.isArray(opts.fail) && opts.fail.includes(key)) throw new Error('S3 boom')
      return {}
    }
  }
}

function fakeCf (opts = {}) {
  const sent = []
  return {
    sent,
    paths: () => sent.flatMap(c => c.input?.InvalidationBatch?.Paths?.Items ?? []),
    async send (command) {
      sent.push(command)
      if (typeof opts.delayMs === 'number') await sleep(opts.delayMs)
      if (opts.fail) throw new Error('CloudFront boom')
      return { Invalidations: { Id: 'I123' } }
    }
  }
}

/** Captures console output so the "skipped / failed but logged" rows can be asserted. */
function captureConsole () {
  const lines = []
  const origLog = console.log
  const origError = console.error
  console.log = (...args) => { lines.push(args) }
  console.error = (...args) => { lines.push(args) }
  return {
    lines,
    text: () => lines.flat().map(entry => {
      if (entry instanceof Error) return entry.message
      if (typeof entry === 'string') return entry
      try { return JSON.stringify(entry) } catch (_err) { return String(entry) }
    }).join('\n'),
    restore () {
      console.log = origLog
      console.error = origError
    }
  }
}

describe('photoObjectKeys / invalidationPaths - key and path contract', () => {
  it('derives exactly the four shapes a photo id can own (original, thumb, video, sidecar)', () => {
    expect(photoObjectKeys(LIVE)).to.deep.equal(FOUR_KEYS)
  })

  it('deletes exact keys only - no prefix or wildcard shapes ever enter the delete set', () => {
    for (const key of photoObjectKeys(LIVE)) {
      expect(key).to.not.include('*')
      expect([`${LIVE}.webp`, `${LIVE}-thumb.webp`, `${LIVE}.mov`, `seo/${LIVE}.json`]).to.include(key)
    }
  })

  it('lowercases an uppercase id once, and the sidecar keeps the seo/<lower-id>.json shape', () => {
    const keys = photoObjectKeys(UPPER)
    expect(keys).to.deep.equal(FOUR_KEYS)
    expect(keys[3]).to.equal(sidecarKey(UPPER))
    expect(keys[3]).to.equal(`seo/${LIVE}.json`)
    expect(keys.every(k => k === k.toLowerCase())).to.equal(true)
  })

  it('wildcards every public path so query-string/cookie cache variants are covered', () => {
    const paths = invalidationPaths(photoObjectKeys(LIVE))
    expect(paths).to.deep.equal(FOUR_PATHS)
    for (const p of paths) {
      // The img distribution caches all query strings and all cookies for 10 days, so an
      // un-wildcarded path would leave every ?v=1 copy serving the deleted photo.
      expect(p.startsWith('/')).to.equal(true)
      expect(p.endsWith('*')).to.equal(true)
    }
  })
})

describe('removePhotoObjects - full cleanup', () => {
  it('deletes all four objects and issues ONE wildcarded invalidation', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(s3.sent.map(c => c.constructor.name)).to.deep.equal(['DeleteObjectCommand', 'DeleteObjectCommand', 'DeleteObjectCommand', 'DeleteObjectCommand'])
    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(s3.sent.every(c => c.input.Bucket === BUCKET)).to.equal(true)

    expect(cf.sent).to.have.lengthOf(1)
    const invalidation = cf.sent[0]
    expect(invalidation.constructor.name).to.equal('CreateInvalidationCommand')
    expect(invalidation.input.DistributionId).to.equal(DISTRO)
    expect(invalidation.input.InvalidationBatch.Paths.Items).to.have.members(FOUR_PATHS)
    // CloudFront rejects a batch whose Quantity does not match its Items, which would silently
    // leave the CDN serving deleted media.
    expect(invalidation.input.InvalidationBatch.Paths.Quantity).to.equal(FOUR_PATHS.length)
    expect(invalidation.input.InvalidationBatch.CallerReference.length).to.be.at.most(128)

    expect(result.deleted).to.have.lengthOf(4)
    expect(result.failures).to.deep.equal([])
    expect(result.invalidation).to.equal('issued')
    expect(result.stoppedAtDeadline).to.equal(false)
  })

  it('treats absent keys as success and still invalidates (partial-object row)', async () => {
    const s3 = fakeS3({ noSuchKey: [`${LIVE}-thumb.webp`, `seo/${LIVE}.json`] })
    const cf = fakeCf()

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(result.failures).to.deep.equal([])
    expect(result.deleted).to.have.lengthOf(4)
    expect(cf.sent).to.have.lengthOf(1)
    expect(result.invalidation).to.equal('issued')
  })

  it('records a delete failure and never rejects; the invalidation still runs', async () => {
    const s3 = fakeS3({ fail: [`${LIVE}.webp`] })
    const cf = fakeCf()
    const logs = captureConsole()

    let result
    try {
      result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })
    } finally {
      logs.restore()
    }

    expect(result.failures).to.deep.equal([{ key: `${LIVE}.webp`, error: 'S3 boom' }])
    expect(result.deleted).to.have.lengthOf(3)
    expect(cf.sent).to.have.lengthOf(1)
  })

  it('survives a CloudFront rejection - cleanup never throws', async () => {
    const s3 = fakeS3()
    const cf = fakeCf({ fail: true })

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    expect(result.invalidation).to.equal('failed')
    expect(result.deleted).to.have.lengthOf(4)
  })
})

describe('removePhotoObjects - no CDN configured (test stack)', () => {
  it('deletes the objects, skips and logs the invalidation, never throws', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()
    const logs = captureConsole()

    let result
    try {
      result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: '', s3, cloudfront: cf })
    } finally {
      logs.restore()
    }

    expect(s3.keys()).to.have.lengthOf(4)
    expect(cf.sent).to.deep.equal([])
    expect(result.invalidation).to.equal('skipped-no-distribution')
    expect(logs.text()).to.include('invalidation skipped')
  })

  it('does nothing at all when no media bucket is configured', async () => {
    const s3 = fakeS3()
    const logs = captureConsole()

    let result
    try {
      result = await removePhotoObjects(LIVE, { bucket: '', distributionId: DISTRO, s3 })
    } finally {
      logs.restore()
    }

    expect(s3.sent).to.deep.equal([])
    expect(result.deleted).to.deep.equal([])
    expect(logs.text()).to.include('no media bucket configured')
  })
})

describe('removePhotoObjects - bounded by its deadline (throttled storage)', () => {
  it('stops deleting at the deadline but still invalidates what it already deleted', async () => {
    const s3 = fakeS3({ delayMs: 120 })
    const cf = fakeCf()
    const started = Date.now()

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf, deadlineMs: 250 })

    expect(result.stoppedAtDeadline).to.equal(true)
    expect(result.deleted.length).to.be.above(0)
    expect(result.deleted.length).to.be.below(4)
    // The reserved slice of the budget exists for this: the removed subset must not keep serving
    // from edge cache for the rest of the 10-day TTL just because later deletes ran out of time.
    expect(cf.sent).to.have.lengthOf(1)
    expect(cf.paths()).to.have.members(invalidationPaths(result.deleted))
    expect(result.invalidation).to.equal('issued')
    // The whole point of the deadline: cleanup must not eat wisawFn's 30 s budget.
    expect(Date.now() - started).to.be.below(2000)
  })

  it('returns at the deadline when a storage call never settles, invalidating the deleted subset', async () => {
    const s3 = fakeS3({ hangAfter: 1 })
    const cf = fakeCf()
    const started = Date.now()

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf, deadlineMs: 150 })

    expect(Date.now() - started).to.be.below(1500)
    expect(result.stoppedAtDeadline).to.equal(true)
    expect(result.deleted).to.deep.equal([`${LIVE}.webp`])
    expect(cf.paths()).to.deep.equal([`/${LIVE}.webp*`])
    expect(result.invalidation).to.equal('issued')
  })

  it('submits no empty invalidation batch when the deadline hits before anything was deleted', async () => {
    const s3 = fakeS3({ hang: true })
    const cf = fakeCf()

    const result = await removePhotoObjects(LIVE, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf, deadlineMs: 150 })

    expect(result.stoppedAtDeadline).to.equal(true)
    expect(result.deleted).to.deep.equal([])
    expect(cf.sent).to.deep.equal([])
    expect(result.invalidation).to.equal('skipped-deadline')
  })
})

describe('deletePhoto - flag-gated cleanup after the soft delete', () => {
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
      if (typeof s3Behaviour.delayMs === 'number') await sleep(s3Behaviour.delayMs)
      if (s3Behaviour.fail) throw new Error('S3 boom')
      return {}
    })
    patch(CloudFrontClient.prototype, 'send', async function (command) {
      log.push(`cf:${command.constructor.name}`)
      calls.cf.push(command)
      if (typeof s3Behaviour.delayMs === 'number') await sleep(s3Behaviour.delayMs)
      return {}
    })
    return calls
  }

  it('parses the flag string-safely: only true/1/yes/on enable cleanup', () => {
    for (const on of ['true', 'TRUE', ' true ', '1', 'yes', 'YES', 'on', 'On']) {
      expect(isCleanupEnabled(on), on).to.equal(true)
    }
    // A plain truthy test on a string would make 'false' turn prod cleanup ON.
    for (const off of ['false', 'FALSE', '0', 'no', 'off', '', 'trueish', undefined, null]) {
      expect(isCleanupEnabled(off), String(off)).to.equal(false)
    }
  })

  it('flag on: soft-deletes first, then deletes all four objects and invalidates once', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', 'true')
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

  it('flag "false": cleanup stays OFF (kill switch) and the mutation still returns OK', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', 'false')
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', DISTRO)

    const log = []
    stubPsql(log)
    const calls = stubStorage(log)

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(calls.s3).to.deep.equal([])
    expect(calls.cf).to.deep.equal([])
  })

  it('flag unset: cleanup is OFF by default', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', undefined)
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', DISTRO)

    const log = []
    stubPsql(log)
    const calls = stubStorage(log)

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(calls.s3).to.deep.equal([])
  })

  it('flag on with storage failures: the mutation still returns OK and the failure is logged', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', 'true')
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

  it('flag on with slow storage: the mutation still returns OK', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', 'on')
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', DISTRO)

    const log = []
    stubPsql(log)
    stubStorage(log, { delayMs: 60 })

    const started = Date.now()
    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    // Four deletes + one invalidation at 60 ms each are comfortably inside the Lambda budget.
    expect(Date.now() - started).to.be.below(1500)
  })

  it('flag on with no distribution configured: objects deleted, no invalidation call', async () => {
    setEnv('PHOTO_DELETE_CLEANUP', '1')
    setEnv('S3_BUCKET', BUCKET)
    setEnv('CLOUD_FRONT_DISTRIBUTION', '')

    const log = []
    stubPsql(log)
    const calls = stubStorage(log)

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(calls.s3.map(c => c.input.Key)).to.have.members(FOUR_KEYS)
    expect(calls.cf).to.deep.equal([])
  })
})

describe('sibling safety - a delete cannot reach another photo', () => {
  // Premise first: SIBLING really does share a prefix with LIVE, so the checks below are not
  // vacuous. A sloppy "delete/invalidates everything under the id prefix" implementation would
  // destroy it, and these assertions catch that.
  const SHARED_PREFIX = LIVE.slice(0, 8)

  it('premise: the sibling collides on the shared prefix', () => {
    expect(SIBLING.startsWith(SHARED_PREFIX)).to.equal(true)
    const siblingKeys = photoObjectKeys(SIBLING)
    // A truncated (prefix-sweep) key would have matched every sibling media object...
    expect(siblingKeys.filter(key => key.startsWith(SHARED_PREFIX))).to.have.lengthOf(3)
    // ...and the sibling sidecar once it is looked at under its seo/ prefix. Both are exactly
    // what the exact-key contract forbids.
    expect(siblingKeys.filter(key => key.startsWith(`seo/${SHARED_PREFIX}`))).to.have.lengthOf(1)
    expect(photoObjectKeys(LIVE).some(key => key === SHARED_PREFIX)).to.equal(false)
  })

  it('deletes only the target keys and no wildcard path can match a sibling object', async () => {
    const s3 = fakeS3()
    const cf = fakeCf()
    const siblingKeys = photoObjectKeys(SIBLING)

    await removePhotoObjects(UPPER, { bucket: BUCKET, distributionId: DISTRO, s3, cloudfront: cf })

    const attempted = s3.keys()
    expect(attempted).to.have.lengthOf(4)
    // No sibling object is deleted...
    expect(attempted.filter(key => siblingKeys.includes(key))).to.deep.equal([])
    // ...and no deleted key is a proper prefix of a sibling key, so `/key*` cannot sweep the
    // sibling's cached copies either. This is the check that fails if keys are ever truncated.
    const collisions = siblingKeys.filter(sibling =>
      attempted.some(key => sibling !== key && sibling.startsWith(key)))
    expect(collisions).to.deep.equal([])

    const targetPaths = invalidationPaths(attempted)
    const siblingPaths = invalidationPaths(siblingKeys)
    const swept = siblingPaths.filter(path =>
      targetPaths.some(p => path !== p && path.startsWith(p.slice(0, -1))))
    expect(swept).to.deep.equal([])
  })

  it('control: the same matcher does detect a broad-prefix invalidation', () => {
    // Guards the test above against being dead code: a '/' + id-prefix sweep (the thing the plan
    // forbids) must be reported as colliding with the sibling.
    const sloppy = `/${SHARED_PREFIX}`
    const siblingPaths = invalidationPaths(photoObjectKeys(SIBLING))
    expect(siblingPaths.filter(path => path.startsWith(sloppy))).to.have.lengthOf(3)
    expect(siblingPaths.filter(path => path.startsWith(`/seo/${SHARED_PREFIX}`))).to.have.lengthOf(1)
  })

  it('lowercases an uppercase id so cleanup hits the real lowercase objects', async () => {
    const s3 = fakeS3()
    await removePhotoObjects(UPPER, { bucket: BUCKET, distributionId: '', s3 })
    expect(s3.keys()).to.have.members(FOUR_KEYS)
    expect(s3.keys().includes(`${UPPER}.webp`)).to.equal(false)
    expect(s3.keys()).to.include(`seo/${LIVE}.json`)
  })
})
