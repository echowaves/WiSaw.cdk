/* eslint-env node */
// ts-node's hook is load-bearing here, not decoration: processDeletedImage imports "../../psql"
// without an extension, which @babel/register and Node 24's own type stripping cannot resolve.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, after, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem, so seed
// the require cache with a stub before anything pulls in psql (the same trick ts-node's
// pem.d.ts plays at build time). Must happen before requiring processDeletedImage. The root
// hook below puts the cache back so no test file loaded after this one inherits a fake CA.
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
const { deleteSeoSidecar, sidecarKey } = require('../lambda-fns/utilities/seoSidecar.ts')
const { main: processDeletedImage } = require('../lambda-fns/lambdas/processDeletedImage/index.ts')
const { classifyKey, extractPhotoId } = require('../scripts/cleanup-s3.js')

const LIVE = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const GONE = '8f2a1111-2222-4333-8444-555566667777'
const UPPER = '35E99E0C-03A1-4F30-80D3-405BC1F3DF35'

// Minimal duck-typed S3Client: records commands, optionally fails DeleteObject.
function fakeS3 (opts = {}) {
  const sent = []
  return {
    sent,
    async send (command) {
      sent.push(command)
      if (opts.failDelete && command.constructor.name === 'DeleteObjectCommand') {
        throw new Error('S3 boom')
      }
      return {}
    }
  }
}

function thumbEvent (id, bucket = 'wisaw-img-prod') {
  return {
    Records: [{
      s3: { bucket: { name: bucket }, object: { key: `${id}-thumb.webp` } }
    }]
  }
}

describe('deleteSeoSidecar - key contract', () => {
  it('issues DeleteObject for seo/<id>.json in the given bucket', async () => {
    const s3 = fakeS3()
    await deleteSeoSidecar(s3, 'wisaw-img-prod', LIVE)

    expect(s3.sent).to.have.length(1)
    const cmd = s3.sent[0]
    expect(cmd.constructor.name).to.equal('DeleteObjectCommand')
    expect(cmd.input.Bucket).to.equal('wisaw-img-prod')
    expect(cmd.input.Key).to.equal(`seo/${LIVE}.json`)
  })

  it('lowercases the id, matching sidecarKey()', async () => {
    const s3 = fakeS3()
    await deleteSeoSidecar(s3, 'wisaw-img-prod', UPPER)
    expect(s3.sent[0].input.Key).to.equal(sidecarKey(UPPER))
    expect(s3.sent[0].input.Key).to.equal(`seo/${LIVE}.json`)
  })

  it('treats an already-absent sidecar as success (no read, NoSuchKey never surfaces)', async () => {
    const s3 = fakeS3()
    await deleteSeoSidecar(s3, 'wisaw-img-prod', GONE)
    expect(s3.sent.map(c => c.constructor.name)).to.deep.equal(['DeleteObjectCommand'])
  })

  it('propagates a real S3 failure so callers can decide to swallow it', async () => {
    const s3 = fakeS3({ failDelete: true })
    try {
      await deleteSeoSidecar(s3, 'wisaw-img-prod', LIVE)
      expect.fail('deleteSeoSidecar should reject when S3 rejects')
    } catch (err) {
      expect(err.message).to.equal('S3 boom')
    }
  })
})

describe('processDeletedImage - sidecar follows the photo into the grave', () => {
  const originals = new Map()
  const patch = (obj, name, value) => {
    originals.set(`${obj}.${name}`, { obj, name, value: obj[name] })
    obj[name] = value
  }
  afterEach(() => {
    for (const { obj, name, value } of originals.values()) obj[name] = value
    originals.clear()
  })

  it('issues DeleteObject for seo/<id>.json when the thumb object is removed', async () => {
    const sent = []
    patch(S3Client.prototype, 'send', async function (command) {
      sent.push(command)
      return {}
    })
    const psql = require('../lambda-fns/psql.ts').default
    patch(psql, 'connect', async () => {})
    patch(psql, 'query', async () => ({ rows: [] }))
    patch(psql, 'clean', async () => {})

    const result = await processDeletedImage(thumbEvent(LIVE), {})

    expect(result).to.equal(true)
    const deletes = sent.filter(c => c.constructor.name === 'DeleteObjectCommand').map(c => c.input)
    expect(deletes).to.deep.include({ Bucket: 'wisaw-img-prod', Key: `seo/${LIVE}.json` })
  })

  it('still returns true when the sidecar delete itself fails', async () => {
    patch(S3Client.prototype, 'send', async function (command) {
      if (String(command.input?.Key ?? '').startsWith('seo/')) throw new Error('sidecar S3 boom')
      return {}
    })
    const psql = require('../lambda-fns/psql.ts').default
    patch(psql, 'connect', async () => {})
    patch(psql, 'query', async () => ({ rows: [] }))
    patch(psql, 'clean', async () => {})

    const errors = []
    patch(console, 'error', (...args) => errors.push(args))

    const result = await processDeletedImage(thumbEvent(LIVE), {})

    expect(result).to.equal(true)
    const flat = errors.flat()
    expect(flat.some(e => String(e).includes('Error deleting seo sidecar'))).to.equal(true)
    expect(flat.some(e => e?.err?.message === 'sidecar S3 boom')).to.equal(true)
  })
})

describe('cleanup-s3 classifyKey - prefix-aware reconciliation', () => {
  const activeIds = new Set([LIVE])

  it('keeps a sidecar whose photo row is active', () => {
    expect(classifyKey(`seo/${LIVE}.json`, activeIds)).to.equal('keep')
  })

  it('prunes a sidecar whose photo row is gone', () => {
    expect(classifyKey(`seo/${GONE}.json`, activeIds)).to.equal('delete')
  })

  it('reports seo/_last-run.json but never deletes it (it used to be junk-classified)', () => {
    expect(classifyKey('seo/_last-run.json', activeIds)).to.equal('report')
  })

  it('never deletes unrecognized keys under seo/', () => {
    for (const key of ['seo/', 'seo/random.json', `seo/${LIVE}.json.bak`, `SEO/${UPPER}.json`, `seo/${LIVE.toUpperCase()}.json`]) {
      expect(classifyKey(key, activeIds), key).to.equal('report')
    }
  })

  it('reports malformed ids under seo/ instead of deleting them', () => {
    for (const key of ['seo/------------------------------------.json', 'seo/35e99e0c03a14f3080d3405bc1f3df35.json', `seo/${LIVE}.JSON`]) {
      expect(classifyKey(key, activeIds), key).to.equal('report')
    }
  })

  it('keeps the existing photo-object rules unchanged', () => {
    expect(classifyKey(`${LIVE}.webp`, activeIds)).to.equal('keep')
    expect(classifyKey(`${LIVE}-thumb.webp`, activeIds)).to.equal('keep')
    expect(classifyKey(`${GONE}.webp`, activeIds)).to.equal('delete')
    expect(classifyKey(`${GONE}-thumb.webp`, activeIds)).to.equal('delete')
    expect(classifyKey(`${GONE}.mov`, activeIds)).to.equal('delete')
  })

  it('reports non-UUID junk instead of deleting it (the mass-delete bug)', () => {
    for (const key of ['deadbeef.webp', 'index.html', 'uploads/tmp.bin']) {
      expect(classifyKey(key, activeIds), key).to.equal('report')
    }
  })

  it('is pure: the same bucket state classifies identically across passes', () => {
    const keys = [`seo/${LIVE}.json`, `seo/${GONE}.json`, 'seo/_last-run.json', `${GONE}.webp`]
    const first = keys.map(k => classifyKey(k, activeIds))
    const second = keys.map(k => classifyKey(k, new Set([LIVE])))
    expect(second).to.deep.equal(first)
  })

  it('never marks an seo/ key of an active photo for deletion (acceptance: live run is safe)', () => {
    const bucket = [`seo/${LIVE}.json`, `seo/${LIVE}-thumb.webp`, 'seo/_last-run.json', `${LIVE}.webp`]
    const doomed = bucket.filter(k => classifyKey(k, activeIds) === 'delete')
    expect(doomed).to.deep.equal([])
  })

  it('extractPhotoId still anchors at the key start (sidecars are not media)', () => {
    expect(extractPhotoId(`seo/${LIVE}.json`)).to.equal(null)
    expect(extractPhotoId(`${LIVE}-thumb.webp`)).to.equal(LIVE)
  })

  it('classifies the plan-design matrix exactly', () => {
    const active = new Set([LIVE])
    expect(classifyKey(`seo/${LIVE}.json`, active)).to.equal('keep') // live photo, keep
    expect(classifyKey(`seo/${GONE}.json`, active)).to.equal('delete') // gone photo, prune
    expect(classifyKey('seo/_last-run.json', active)).to.equal('report') // was: delete
    expect(classifyKey(`${GONE}.webp`, active)).to.equal('delete') // existing rule unchanged
  })
})
