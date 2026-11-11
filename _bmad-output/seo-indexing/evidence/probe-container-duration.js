#!/usr/bin/env node
/* eslint-env node */

// Evidence tool for seo-indexing ticket 8: what does reading a real video's length out of its own
// container actually cost, and how many production files answer at all? The scheduled learning pass
// is bounded (150 videos per run) precisely because nobody had measured this, so the bound was a
// guess until now.
//
//   node probe-container-duration.js [--every=20] [--limit=40] [--concurrent=6]
//
// Read-only: HeadObject plus ranged GetObject, nothing is written and no row is touched. The probe
// used here is the production one (lambda-fns/controllers/photos/_learnVideoDurations.ts), not a
// copy, so these numbers describe the code that ships.

require('ts-node/register/transpile-only')

const fs = require('fs')
const path = require('path')
const Module = require('module')
const { S3Client } = require('@aws-sdk/client-s3')

const pemPath = path.resolve(__dirname, '../../../lambda-fns/certs/global-bundle.pem')
if (require.cache[pemPath] === undefined) {
  const stub = new Module(pemPath, null)
  stub.filename = pemPath
  stub.loaded = true
  stub.exports = 'FAKE-CA-FOR-TESTS'
  require.cache[pemPath] = stub
}

const { probeVideoDuration } = require('../../../lambda-fns/controllers/photos/_learnVideoDurations.ts')

const BUCKET = process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
const args = process.argv.slice(2)
const numArg = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit == null ? dflt : Number(hit.split('=')[1])
}
const every = Math.max(1, numArg('every', 20))
const limit = numArg('limit', 40)
const concurrent = Math.max(1, numArg('concurrent', 6))

const all = fs.readFileSync(path.join(__dirname, 'video-keys-2026-11-11.txt'), 'utf8')
  .split('\n').map((line) => line.trim()).filter(Boolean)
let keys = all.filter((_, i) => i % every === 0)
if (limit > 0) keys = keys.slice(0, limit)

const s3 = new S3Client({ region: 'us-east-1' })

function quantile (sorted, q) {
  if (sorted.length === 0) return 0
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))
  return sorted[at]
}

function human (seconds) {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(s % 60).padStart(2, '0')}s`
}

async function main () {
  console.log(`bucket=${BUCKET} corpus=${all.length} keys sampled=${keys.length} concurrency=${concurrent}`)
  const results = []
  const startedAt = Date.now()

  for (let i = 0; i < keys.length; i += concurrent) {
    const chunk = keys.slice(i, i + concurrent)
    const settled = await Promise.allSettled(chunk.map(async (key) => {
      const stats = { bytes: 0, reads: 0 }
      const t0 = Date.now()
      const seconds = await probeVideoDuration(s3, BUCKET, key, stats)
      return { key, seconds, ...stats, ms: Date.now() - t0 }
    }))
    settled.forEach((res, index) => {
      if (res.status === 'rejected') {
        console.log(`  ${chunk[index]} ERROR`)
        return
      }
      const r = res.value
      results.push(r)
      console.log(`  ${r.key} → ${r.seconds == null ? 'no duration' : `${r.seconds}s (${human(r.seconds)})`} bytes=${r.bytes} reads=${r.reads} ms=${r.ms}`)
    })
  }

  const parsed = results.filter((r) => r.seconds != null)
  const durations = parsed.map((r) => r.seconds).sort((a, b) => a - b)
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0)
  const totalReads = results.reduce((sum, r) => sum + r.reads, 0)

  console.log('\n--- summary ---')
  console.log(`answered=${parsed.length}/${results.length} refused=${results.length - parsed.length}`)
  if (parsed.length > 0) {
    console.log(`duration seconds: min=${durations[0]} median=${quantile(durations, 0.5)} p90=${quantile(durations, 0.9)} max=${durations[durations.length - 1]}`)
    console.log(`duration human: ${human(durations[0])} .. ${human(quantile(durations, 0.5))} .. ${human(durations[durations.length - 1])}`)
  }
  const n = results.length || 1
  console.log(`per video: bytes=${Math.round(totalBytes / n)} requests=${(totalReads / n).toFixed(2)} (ranged GETs; +1 HEAD each) ms=${Math.round(results.reduce((sum, r) => sum + r.ms, 0) / n)}`)
  console.log(`wall clock for ${results.length} videos: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

main().catch((err) => {
  console.error('probe failed', err)
  process.exitCode = 1
})
