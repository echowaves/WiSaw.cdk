/* eslint-env node */
// ts-node's hook is load-bearing: _updateSeoSidecar imports "../../psql" without an extension.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')
const { describe, it, afterEach } = require('mocha')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem.
const pemPath = path.resolve(__dirname, '../lambda-fns/certs/global-bundle.pem')
const pemWas = require.cache[pemPath]
if (pemWas === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

const { S3Client } = require('@aws-sdk/client-s3')
const { loadSeoPhotoRow, _updateSeoSidecar } = require('../lambda-fns/controllers/photos/_updateSeoSidecar.ts')
const psql = require('../lambda-fns/psql.ts').default

const BUCKET = 'wisaw-img-test'
const ID = '35e99e0c-03a1-4f30-80d3-405bc1f3df35'

/** The newest comment is the sidecar's caption, so a comment edit must republish the object. */
function photoRow (overrides = {}) {
  return {
    id: ID,
    active: true,
    createdAt: new Date('2026-11-07T03:52:44Z'),
    lastComment: 'golden hour at Coney Island',
    labels: ['Sunset', 'Beach'],
    width: 1200,
    height: 800,
    locality: 'Brooklyn',
    district: null,
    region: 'New York',
    ...overrides
  }
}

describe('_updateSeoSidecar - comment edits keep the sidecar current', () => {
  let restores = []
  const patch = (obj, name, value) => {
    const orig = obj[name]
    obj[name] = value
    restores.push(() => { obj[name] = orig })
  }
  afterEach(() => {
    for (const f of restores) f()
    restores = []
    delete process.env.S3_BUCKET
  })

  function stubPsql (rows) {
    const sql = []
    patch(psql, 'connect', async () => {})
    patch(psql, 'clean', async () => {})
    patch(psql, 'query', async (statement, params) => {
      sql.push({ statement, params })
      return typeof rows === 'function' ? rows(statement) : { rows }
    })
    return sql
  }

  function stubS3 (opts = {}) {
    const puts = []
    patch(S3Client.prototype, 'send', async function (command) {
      if (command.constructor.name !== 'PutObjectCommand') return {}
      if (opts.fail) throw new Error('S3 boom')
      puts.push(command.input)
      return {}
    })
    return puts
  }

  function watchErrors () {
    const lines = []
    patch(console, 'error', (...args) => lines.push(args))
    return lines
  }

  it('loadSeoPhotoRow reads the full publisher row and releases the connection', async () => {
    const sql = stubPsql([photoRow()])

    const row = await loadSeoPhotoRow(ID)

    expect(row.id).to.equal(ID)
    expect(sql).to.have.length(1)
    // The labels aggregate and the address columns are what make the sidecar worth publishing,
    // and the geography column must stay out of the SELECT.
    expect(sql[0].statement).to.match(/jsonb_agg/)
    expect(sql[0].statement).to.match(/"active" = true/)
    // p.* carries the address columns; the geography column must never be named, and
    // buildSeoSidecar's guard is what actually keeps a coordinate out of the object.
    expect(sql[0].statement).to.not.match(/p\."location"/)
    expect(sql[0].params).to.deep.equal([ID])
  })

  it('returns null instead of a row when the photo is missing or inactive', async () => {
    stubPsql([])
    expect(await loadSeoPhotoRow(ID)).to.equal(null)
  })

  it('PUTs <id>.json with the comment as caption', async () => {
    process.env.S3_BUCKET = BUCKET
    stubPsql([photoRow()])
    const puts = stubS3()

    await _updateSeoSidecar(ID)

    expect(puts).to.have.length(1)
    expect(puts[0].Bucket).to.equal(BUCKET)
    expect(puts[0].Key).to.equal(`${ID}.json`)
    expect(puts[0].ContentType).to.equal('application/json')
    const body = JSON.parse(puts[0].Body)
    expect(body.caption).to.equal('golden hour at Coney Island')
    expect(body.labels).to.deep.equal(['Sunset', 'Beach'])
    expect(body.location).to.equal('Brooklyn, New York')
  })

  it('skips the write when no media bucket is configured', async () => {
    delete process.env.S3_BUCKET
    stubPsql([photoRow()])
    const puts = stubS3()

    await _updateSeoSidecar(ID)

    expect(puts).to.deep.equal([])
  })

  it('skips the write for a photo that is gone or inactive', async () => {
    process.env.S3_BUCKET = BUCKET
    stubPsql([])
    const puts = stubS3()

    await _updateSeoSidecar(ID)

    expect(puts).to.deep.equal([])
  })

  it('swallows every failure: a lost enrichment must never fail the user\'s mutation', async () => {
    process.env.S3_BUCKET = BUCKET
    stubPsql([photoRow()])
    stubS3({ fail: true })
    const errors = watchErrors()

    const result = await _updateSeoSidecar(ID)
    expect(result).to.equal(undefined)
    expect(errors.flat().some((entry) => String(entry).includes('Error refreshing seo sidecar'))).to.equal(true)
  })

  it('swallows a database failure too', async () => {
    process.env.S3_BUCKET = BUCKET
    patch(psql, 'connect', async () => { throw new Error('db down') })
    const puts = stubS3()
    watchErrors()

    await _updateSeoSidecar(ID)

    expect(puts).to.deep.equal([])
  })
})
