#!/usr/bin/env node
/* eslint-env node */

// Evidence tool for seo-indexing ticket 8: how many stored video objects actually carry a
// duration, and in what shape? The answer decides whether the real duration can be read at
// write time from S3 user metadata or has to come from somewhere else, and how big a backfill
// over existing rows would be.
//
//   node probe-duration-metadata.js [--every=8] [--limit=200] [--keys=video-keys-2026-11-11.txt]
//
// Read-only: HeadObject only, nothing is written to the bucket.

const fs = require('fs')
const path = require('path')
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3')

const BUCKET = process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'
const args = process.argv.slice(2)
const numArg = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit == null ? dflt : Number(hit.split('=')[1])
}
const every = Math.max(1, numArg('every', 8))
const limit = numArg('limit', 0)
const keysFile = (args.find((a) => a.startsWith('--keys=')) || '').split('=')[1] ||
  path.join(__dirname, 'video-keys-2026-11-11.txt')

const all = fs.readFileSync(keysFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
let keys = all.filter((_, i) => i % every === 0)
if (limit > 0) keys = keys.slice(0, limit)

const client = new S3Client({ region: 'us-east-1' })

// Values are classified rather than printed in full so the evidence file stays readable.
function classify (raw) {
  if (raw == null || raw === '') return 'absent'
  const text = String(raw).trim()
  if (/^\d+(\.\d+)?$/.test(text)) return `seconds:${text}`
  if (/^PT/i.test(text)) return `iso8601:${text}`
  if (/^\d+:\d{2}(:\d{2})?$/.test(text)) return `clock:${text}`
  return `other:${text.slice(0, 24)}`
}

async function head (key) {
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return {
      key,
      error: '',
      type: r.ContentType || '',
      size: r.ContentLength || 0,
      metaKeys: Object.keys(r.Metadata || {}).sort().join(','),
      duration: classify(r.Metadata && r.Metadata.duration)
    }
  } catch (err) {
    return { key, error: (err && err.name) || 'error', type: '', size: 0, metaKeys: '', duration: 'error' }
  }
}

async function main () {
  const out = []
  for (let i = 0; i < keys.length; i += 12) {
    const chunk = await Promise.all(keys.slice(i, i + 12).map(head))
    out.push(...chunk)
  }

  const tally = new Map()
  const metaTally = new Map()
  for (const row of out) {
    const kind = row.duration.startsWith('seconds:') ? 'seconds'
      : row.duration.startsWith('iso8601:') ? 'iso8601'
        : row.duration.startsWith('clock:') ? 'clock' : row.duration
    tally.set(kind, (tally.get(kind) || 0) + 1)
    metaTally.set(row.metaKeys || '(none)', (metaTally.get(row.metaKeys || '(none)') || 0) + 1)
  }

  console.log(`bucket=${BUCKET} keys-total=${all.length} sampled=${out.length} every=${every}`)
  console.log('duration metadata:')
  ;[...tally.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}\t${k}`))
  console.log('raw duration values seen:')
  out.filter((r) => r.duration !== 'absent' && r.duration !== 'error').slice(0, 10)
    .forEach((r) => console.log(`  ${r.key} -> ${r.duration}`))
  console.log('user-metadata key sets seen:')
  ;[...metaTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${v}\t${k}`))
  const errs = out.filter((r) => r.error)
  console.log(`head errors: ${errs.length}${errs.length ? ` (${errs[0].error})` : ''}`)
}

void main()
