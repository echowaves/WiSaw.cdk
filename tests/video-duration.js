/* eslint-env node */
/* global require, describe, it, Buffer, BigInt */

// Ticket 8: the duration a page publishes must be the length the video actually has.
//
// Production carried no upload-time metadata on any video object (evidence/probe-duration-metadata.js),
// so the only real source is the container header itself. These fixtures are hand-built QuickTime
// boxes rather than recordings, because the parser's contract is about layout: where moov sits, which
// mvhd version it holds, and what it must refuse to believe.

// ts-node's hook is load-bearing: _learnVideoDurations imports "../../psql" without an extension.
require('ts-node/register/transpile-only')

const Module = require('module')
const path = require('path')
const { expect } = require('chai')

// lambda-fns/psql.ts imports the RDS CA bundle as a module; Node cannot parse .pem.
const pemPath = path.resolve(__dirname, '../lambda-fns/certs/global-bundle.pem')
if (require.cache[pemPath] === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

const { durationFromContainer, MAX_DURATION_SECONDS } = require('../lambda-fns/utilities/videoDuration.js')
const rules = require('../lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js')
const learner = require('../lambda-fns/controllers/photos/_learnVideoDurations.ts')
const psql = require('../lambda-fns/psql.ts').default

function box (type, payload, shape = {}) {
  const total = (shape.large ? 16 : 8) + payload.length
  const head = Buffer.alloc(shape.large ? 16 : 8)
  if (shape.size != null) head.writeUInt32BE(shape.size, 0)
  else if (shape.large) head.writeUInt32BE(1, 0)
  else head.writeUInt32BE(shape.openEnded ? 0 : total, 0)
  Buffer.from(type, 'latin1').copy(head, 4)
  if (shape.large) head.writeBigUInt64BE(BigInt(total), 8)
  return Buffer.concat([head, payload])
}

function mvhdBox ({ version = 0, timescale, duration }) {
  if (version === 1) {
    const body = Buffer.alloc(32)
    body[0] = 1
    body.writeUInt32BE(timescale, 20)
    body.writeBigUInt64BE(BigInt(duration), 24)
    return box('mvhd', body)
  }
  const body = Buffer.alloc(20)
  body[0] = 0
  body.writeUInt32BE(timescale, 12)
  body.writeInt32BE(duration, 16)
  return box('mvhd', body)
}

function moov (opts, shape = {}) {
  // A sibling before mvhd proves the walker advances past boxes it does not want.
  const payload = Buffer.concat([box('udta', Buffer.alloc(8)), mvhdBox(opts)])
  return box('moov', payload, shape)
}

// Stands in for the shared psql client so the write path can be observed without a database.
function stubDb () {
  const calls = []
  const original = { connect: psql.connect, query: psql.query, clean: psql.clean }
  let connects = 0
  let cleans = 0
  psql.connect = async () => { connects += 1 }
  psql.query = async (sql, values) => { calls.push({ sql, values }); return { rows: [] } }
  psql.clean = async () => { cleans += 1 }
  return {
    learner,
    calls,
    stats: () => ({ connects, cleans }),
    restore () { Object.assign(psql, original) }
  }
}

function trackedSource (buf) {
  const state = { bytesRead: 0, reads: 0 }
  return {
    state,
    size: buf.length,
    read: async (offset, length) => {
      state.reads += 1
      const bytes = buf.subarray(offset, offset + length)
      state.bytesRead += bytes.length
      return bytes
    }
  }
}

describe('durationFromContainer', () => {
  it('reads a moov that comes first (faststart layout)', async () => {
    const file = Buffer.concat([box('ftyp', Buffer.alloc(24)), moov({ timescale: 1000, duration: 48750 }), box('mdat', Buffer.alloc(64))])
    expect(await durationFromContainer(trackedSource(file))).to.equal(48)
  })

  it('reads a moov written at the end of the file (iPhone recording)', async () => {
    const mdat = box('mdat', Buffer.alloc(1024 * 1024))
    const file = Buffer.concat([box('ftyp', Buffer.alloc(24)), mdat, moov({ timescale: 600, duration: 108_000 })])
    expect(file.length).to.be.greaterThan(512 * 1024)
    expect(await durationFromContainer(trackedSource(file))).to.equal(180)
  })

  it('reads a version-1 mvhd with a 64-bit duration', async () => {
    const file = Buffer.concat([moov({ version: 1, timescale: 10_000, duration: 750_000 }, { large: true })])
    expect(await durationFromContainer(trackedSource(file))).to.equal(75)
  })

  it('treats a zero-size box as running to the end of its container', async () => {
    const file = Buffer.concat([moov({ timescale: 1000, duration: 3200 }, { openEnded: true })])
    expect(await durationFromContainer(trackedSource(file))).to.equal(3)
  })

  it('returns null for a fragmented file with no mvhd anywhere', async () => {
    const file = Buffer.concat([box('ftyp', Buffer.alloc(24)), box('moof', Buffer.alloc(64)), box('mdat', Buffer.alloc(512))])
    expect(await durationFromContainer(trackedSource(file))).to.equal(null)
  })

  it('stops on a corrupt box header instead of walking into the file', async () => {
    const broken = Buffer.concat([box('ftyp', Buffer.alloc(24), { size: 3 }), moov({ timescale: 1000, duration: 5000 })])
    expect(await durationFromContainer(trackedSource(broken))).to.equal(null)
  })

  it('rejects an implausible length rather than publishing it', async () => {
    const file = Buffer.concat([moov({ timescale: 1, duration: MAX_DURATION_SECONDS + 10 })])
    expect(await durationFromContainer(trackedSource(file))).to.equal(null)
  })

  it('returns null for a source that is too small to be a video', async () => {
    expect(await durationFromContainer(trackedSource(Buffer.alloc(12)))).to.equal(null)
  })

  it('reads bounded windows, not the object', async () => {
    const mdat = box('mdat', Buffer.alloc(8 * 1024 * 1024))
    const file = Buffer.concat([box('ftyp', Buffer.alloc(24)), mdat, moov({ timescale: 1000, duration: 61_000 })])
    const source = trackedSource(file)
    expect(await durationFromContainer(source)).to.equal(61)
    expect(source.state.bytesRead).to.be.lessThan(700 * 1024)
    expect(source.state.reads).to.be.at.most(3)
  })
})

describe('duration rules', () => {
  it('accepts the shapes a stored value can arrive in', () => {
    expect(rules.durationSeconds(48)).to.equal(48)
    expect(rules.durationSeconds('120')).to.equal(120)
    expect(rules.durationSeconds('0:48')).to.equal(48)
    expect(rules.durationSeconds('1:02:03')).to.equal(3723)
    expect(rules.durationSeconds('PT1H2M3S')).to.equal(3723)
    expect(rules.durationSeconds('PT48.9S')).to.equal(48)
  })

  it('answers null for anything that is not a real duration', () => {
    expect(rules.durationSeconds(null)).to.equal(null)
    expect(rules.durationSeconds('')).to.equal(null)
    expect(rules.durationSeconds('0')).to.equal(null)
    expect(rules.durationSeconds(-5)).to.equal(null)
    expect(rules.durationSeconds('soon'))
      .to.equal(null)
    expect(rules.durationSeconds(MAX_DURATION_SECONDS * 2)).to.equal(null)
    expect(rules.durationSeconds(true)).to.equal(null)
  })

  it('formats ISO 8601 the way VideoObject wants it', () => {
    expect(rules.iso8601Duration(48)).to.equal('PT48S')
    expect(rules.iso8601Duration('0:48')).to.equal('PT48S')
    expect(rules.iso8601Duration(125)).to.equal('PT2M5S')
    expect(rules.iso8601Duration(3723)).to.equal('PT1H2M3S')
    expect(rules.iso8601Duration(null)).to.equal('')
  })

  it('publishes duration in a record only when it is known', () => {
    const row = { id: '35e99e0c-03a1-4f30-80d3-405bc1f3df35', video: true, createdAt: new Date('2025-09-14T18:30:00.000Z'), lastComment: 'clip' }
    const unknown = rules.buildSeoRecord(row)
    expect(unknown).to.not.have.property('duration')

    const known = rules.buildSeoRecord({ ...row, duration: 48 })
    expect(known.duration).to.equal(48)
    // Every other field must be untouched by the new one.
    expect(JSON.stringify({ ...known, duration: undefined })).to.equal(JSON.stringify(unknown))
  })

  it('normalizes a legacy string duration into seconds', () => {
    const fields = rules.buildSeoFields({ sidecar: { duration: '1:02:03' }, entityLabel: 'video', imageIdText: 'x' })
    expect(fields.duration).to.equal(3723)
  })
})

describe('storing a learned duration', () => {
  it('writes the seconds for every learned row through one connection', async () => {
    const db = stubDb()
    try {
      await db.learner.storeDurations([{ id: 'a-1', seconds: 48 }, { id: 'b-2', seconds: 3725 }])
    } finally {
      db.restore()
    }
    expect(db.calls.map((call) => call.values)).to.deep.equal([['a-1', 48], ['b-2', 3725]])
    // psql is a module-level shared client: connecting per row would race the rest of the lambda.
    expect(db.stats()).to.deep.equal({ connects: 1, cleans: 1 })
  })

  it('touches only the duration column', () => {
    const sql = learner.STORE_DURATION_SQL
    // A learned length is not an edit: bumping "updatedAt" would push every probed video back into
    // the sidecar refresh window on each scheduled run.
    expect(sql).to.not.include('updatedAt')
    expect(sql).to.match(/SET "duration" = \$2 WHERE "id" = \$1/)
  })

  it('leaves the database alone when nothing was learned', async () => {
    const db = stubDb()
    try {
      await db.learner.storeDurations([])
    } finally {
      db.restore()
    }
    expect(db.stats()).to.deep.equal({ connects: 0, cleans: 0 })
  })
})

describe('the learning pass', () => {
  // Stands in for S3 well enough for the learner's own logic: which rows it touches, what it does
  // with an answer, and what it leaves alone when a file says nothing.
  function fakeS3 (objects) {
    const seen = []
    return {
      seen,
      async send (command) {
        const input = command.input ?? {}
        const name = command.constructor?.name ?? ''
        seen.push(name)
        if (name === 'ListObjectsV2Command') {
          const id = String(input.Prefix ?? '').replace(/\.$/, '')
          return { Contents: objects[id] != null ? [{ Key: `${id}.mov` }] : [] }
        }
        const entry = objects[String(input.Key ?? '').split('.')[0]]
        if (entry == null) throw Object.assign(new Error('NoSuchKey'), { name: 'NotFound' })
        if (name === 'GetObjectCommand') {
          const [, from, to] = /bytes=(\d+)-(\d+)/.exec(input.Range)
          const bytes = entry.subarray(Number(from), Number(to) + 1)
          return { Body: { transformToByteArray: async () => new Uint8Array(bytes) } }
        }
        return { ContentLength: entry.length }
      }
    }
  }

  const ANSWERING = Buffer.concat([box('ftyp', Buffer.alloc(24)), moov({ timescale: 1000, duration: 48000 }), box('mdat', Buffer.alloc(2048))])
  const SILENT = Buffer.concat([box('ftyp', Buffer.alloc(24)), box('mdat', Buffer.alloc(2048))])

  it('learns from the rows that answer and leaves the rest untouched', async () => {
    const db = stubDb()
    const client = fakeS3({ v1: ANSWERING, v2: SILENT })
    const rows = [
      { id: 'v1', video: true, duration: null },
      { id: 'p1', video: false, duration: null },
      { id: 'v2', video: true, duration: null }
    ]
    let result = null
    try {
      result = await learner.learnVideoDurations(rows, { bucket: 'wisaw-img-test', client })
    } finally {
      db.restore()
    }
    expect(result.checked).to.equal(2) // the photo is not a candidate at all
    expect(result.learned.map((row) => row.id)).to.deep.equal(['v1'])
    expect(result.failed).to.equal(0)
    // Mutated in place, so the caller publishes this run's record with the value it just learned.
    expect(rows[0].duration).to.equal(48)
    expect(rows[2].duration).to.equal(null)
    expect(db.calls.map((call) => call.values)).to.deep.equal([['v1', 48]])
  })

  it('bounds the work per run without losing what it did read', async () => {
    const db = stubDb()
    const client = fakeS3({ v1: ANSWERING, v2: ANSWERING })
    const rows = [{ id: 'v1', video: true }, { id: 'v2', video: true }]
    let limited = null
    try {
      limited = await learner.learnVideoDurations(rows, { bucket: 'wisaw-img-test', client, limit: 1 })
    } finally {
      db.restore()
    }
    expect(limited.checked).to.equal(1)
    expect(limited.learned.map((row) => row.id)).to.deep.equal(['v1'])
  })

  it('does not ask storage for a video that already has a duration', async () => {
    const db = stubDb()
    const client = fakeS3({ v1: ANSWERING })
    let result = null
    try {
      result = await learner.learnVideoDurations([{ id: 'v1', video: true, duration: 48 }], { bucket: 'wisaw-img-test', client })
    } finally {
      db.restore()
    }
    expect(result.checked).to.equal(0)
    expect(client.seen).to.deep.equal([])
    expect(db.stats()).to.deep.equal({ connects: 0, cleans: 0 })
  })
})
