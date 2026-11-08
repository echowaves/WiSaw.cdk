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
// require cache with a stub before anything pulls in psql. Must happen before requiring delete.ts.
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
const deletePhoto = require('../lambda-fns/controllers/photos/delete.ts').default
const psql = require('../lambda-fns/psql.ts').default

const LIVE = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'
const CALLER = '8f2a1111-2222-4333-8444-555566667777'

// deletePhoto is a soft delete and nothing more: it flips Photos.active=false. It must never touch
// S3 or CloudFront, because a user- or bot-driven delete that destroys stored media cannot be
// undone, while a flag flip can. scripts/cleanup-s3.js — reviewed and confirmed by a human — is
// what removes objects. These tests pin that boundary.
describe('deletePhoto - soft delete only', () => {
  let restores = []
  const patch = (obj, name, value) => {
    const orig = obj[name]
    obj[name] = value
    restores.push(() => { obj[name] = orig })
  }
  afterEach(() => { for (const f of restores) f(); restores = [] })

  /** psql stub recording every statement; answers the queries deletePhoto actually issues. */
  function stubPsql (opts = {}) {
    const sql = []
    patch(psql, 'connect', async () => {})
    patch(psql, 'clean', async () => {})
    patch(psql, 'query', async (statement, params) => {
      sql.push({ statement, params })
      if (/freezeMode/i.test(statement)) {
        return { rows: opts.frozen ? [{ waveUuid: 'w-1', role: opts.role ?? 'member' }] : [] }
      }
      if (/"Waves"/i.test(statement)) return { rows: [{ photosCount: 0 }] }
      if (/SELECT "waveUuid" FROM "WavePhotos"/i.test(statement)) {
        return { rows: opts.inWave ? [{ waveUuid: 'w-1' }] : [] }
      }
      return { rows: [] }
    })
    return sql
  }

  /** Records any storage or CDN call, so "zero calls" can be asserted. */
  function stubStorage () {
    const calls = []
    patch(S3Client.prototype, 'send', async function (command) {
      calls.push(`s3:${command.constructor.name}`)
      return {}
    })
    patch(CloudFrontClient.prototype, 'send', async function (command) {
      calls.push(`cf:${command.constructor.name}`)
      return {}
    })
    return calls
  }

  it('marks the photo inactive and nothing else', async () => {
    const sql = stubPsql()
    const calls = stubStorage()

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')

    const deactivate = sql.filter((entry) => /UPDATE "Photos"/i.test(entry.statement))
    expect(deactivate).to.have.length(1)
    expect(deactivate[0].statement).to.match(/SET\s+"active" = false/i)
    expect(deactivate[0].params).to.deep.equal([LIVE])
    expect(sql.some((entry) => /DELETE\s+FROM/i.test(entry.statement))).to.equal(false)
    expect(calls).to.deep.equal([])
  })

  it('makes no S3 or CloudFront call even when bucket and distribution are configured', async () => {
    stubPsql()
    const calls = stubStorage()
    const wasBucket = process.env.S3_BUCKET
    const wasDistro = process.env.CLOUD_FRONT_DISTRIBUTION
    process.env.S3_BUCKET = 'wisaw-img-prod'
    process.env.CLOUD_FRONT_DISTRIBUTION = 'E3R5Y1ZTD8Z237'
    try {
      expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
      expect(calls).to.deep.equal([])
    } finally {
      if (wasBucket === undefined) delete process.env.S3_BUCKET
      else process.env.S3_BUCKET = wasBucket
      if (wasDistro === undefined) delete process.env.CLOUD_FRONT_DISTRIBUTION
      else process.env.CLOUD_FRONT_DISTRIBUTION = wasDistro
    }
  })

  it('refreshes the wave photo count when the photo belonged to a wave', async () => {
    const sql = stubPsql({ inWave: true })

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(sql.some((entry) => /UPDATE "Waves"/i.test(entry.statement))).to.equal(true)
  })

  it('refuses to delete a photo in a frozen wave unless the caller owns the wave', async () => {
    stubPsql({ frozen: true, role: 'member' })
    stubStorage()

    try {
      await deletePhoto(LIVE, CALLER)
      expect.fail('a frozen-wave delete must throw')
    } catch (err) {
      expect(err.message).to.equal('Cannot delete a photo that is in a frozen wave')
    }
  })

  it('lets the wave owner delete from a frozen wave', async () => {
    const sql = stubPsql({ frozen: true, role: 'owner' })

    expect(await deletePhoto(LIVE, CALLER)).to.equal('OK')
    expect(sql.some((entry) => /SET\s+"active" = false/i.test(entry.statement))).to.equal(true)
  })

  it('rejects a malformed photo id before touching storage', async () => {
    stubPsql()
    const calls = stubStorage()

    try {
      await deletePhoto('not-a-uuid', CALLER)
      expect.fail('a malformed id must throw')
    } catch (_err) {
      expect(calls).to.deep.equal([])
    }
  })
})
