import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'

// One sidecar per photo/video, read by Lambda@Edge, which cannot join the VPC to reach
// Postgres. The shape is a contract with the edge injector (see
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js and seoText.js); tests/seo-crawler-contract.js
// pins the fields that reader consumes, so change both sides in one commit - dropping a field here
// without updating the reader silently degrades every photo page, which is exactly the class of bug
// that once cost ~22k pages their index. Every writer must go through buildSeoSidecar so call sites
// cannot drift.
//
// These objects are public: seo/<id>.json sits in the media bucket behind img.wisaw.com, so
// anyone who has a photo URL can read one. A place NAME is fair page content ("Coney Island,
// New York" is what makes a photo rankable), but a COORDINATE is not - it pinpoints where a
// person stood, and once crawled from a guessable URL it cannot be unpublished. Everything
// here therefore derives from the address columns, never from "Photos"."location", and
// assertNoPreciseLocation refuses to build anything that looks like a coordinate anyway.

export const SEO_SIDECAR_VERSION = 1

export interface SeoSidecar {
  v: number
  caption: string
  labels: string[]
  created: string
  location: string
  width: string
  height: string
}

export function clean (value: any): string {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

// Newest-first label list from the Rekognition JSONB blob, de-duplicated case-insensitively.
export function pickLabels (rows: any[], limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    for (const label of Array.isArray(row?.labels) ? row.labels : []) {
      const name = clean(label)
      if (name === '') continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
      if (out.length >= limit) return out
    }
  }
  return out
}

// High-level place text ("Brooklyn, New York"), built from the address columns only. It is
// never read from the "location" geography column - see assertNoPreciseLocation below.
export function locationText (row: any): string {
  return [row?.locality, row?.district, row?.region]
    .map((part) => clean(part))
    .filter(Boolean)
    // "Brooklyn, New York" reads well; a repeated place name does not.
    .filter((part: string, i: number, all: string[]) => all.indexOf(part) === i)
    .join(', ')
}

// Key names that can only ever mean a coordinate. Free-text fields (caption, labels) are not
// scanned for them: someone writing "40.68, -73.97" in a comment must not lose their SEO text.
const PRECISE_KEYS = ['lat', 'lon', 'lng', 'latitude', 'longitude', 'coords', 'coordinates', 'gps', 'geopoint', 'point']

/** True for anything that carries a position rather than a place name. */
export function isPreciseLocation (value: any): boolean {
  if (value == null) return false
  // A Sequelize/geography value arrives as an object ({latitude, longitude} or a Point).
  if (typeof value === 'object') return true
  const text = String(value).trim()
  if (text === '') return false
  return /POINT\s*\(/i.test(text) ||
    // WKB/EWKB hex as Postgres hands back for a geography column.
    /^0[01][0-9A-Fa-f]{16,}$/.test(text) ||
    // "40.6833, -73.9740" or "40.6833 -73.9740"
    /^-?\d{1,3}\.\d+\s*[,\s]\s*-?\d{1,3}\.\d+$/.test(text)
}

// Throws instead of publishing. A coordinate on ~21k public objects is not recoverable after
// the fact, so a writer that is unsure fails the photo rather than guessing - and a failed PUT
// only costs one photo its enriched title until the next run.
export function assertNoPreciseLocation (body: Record<string, any>): void {
  const badKey = Object.keys(body).find((key) => PRECISE_KEYS.includes(key.toLowerCase()))
  if (badKey != null) {
    throw new Error(`refusing to publish a sidecar with a coordinate field: ${badKey}`)
  }
  if (isPreciseLocation(body.location)) {
    throw new Error('refusing to publish a sidecar whose location is a coordinate, not a place name')
  }
}

// Tolerates partial rows: a photo that has no labels or place yet yields empty fields rather
// than throwing. Callers that only hold a few columns (the comment path, for instance) must
// still load the full row first, otherwise they overwrite a complete sidecar with a thinner one.
// A row may carry a "location" geometry column; it is ignored here and rejected by the guard.
export function buildSeoSidecar (photo: any): SeoSidecar {
  const createdMs = photo?.createdAt == null ? NaN : new Date(photo.createdAt).getTime()
  const sidecar: SeoSidecar = {
    v: SEO_SIDECAR_VERSION,
    caption: clean(photo?.lastComment).slice(0, 200),
    labels: pickLabels([photo]),
    // An unreadable createdAt yields an empty field rather than throwing mid-batch.
    created: Number.isFinite(createdMs) ? new Date(createdMs).toISOString() : '',
    location: locationText(photo),
    width: clean(photo?.width),
    height: clean(photo?.height)
  }
  assertNoPreciseLocation(sidecar)
  return sidecar
}

export function sidecarKey (id: any): string {
  return `seo/${String(id).toLowerCase()}.json`
}

export async function putSeoSidecar (client: S3Client, bucket: string, photo: any): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: sidecarKey(photo?.id),
    Body: JSON.stringify(buildSeoSidecar(photo)),
    ContentType: 'application/json',
    // The edge injector caches this in memory; the object needs no caching of its own and is
    // overwritten on the next write if anything changes.
    CacheControl: 'max-age=60'
  }))
}

export interface SidecarWriteResult { written: number, failed: number }

export async function putSeoSidecars (client: S3Client, bucket: string, photos: any[], concurrency: number): Promise<SidecarWriteResult> {
  let written = 0
  let failed = 0

  for (let i = 0; i < photos.length; i += concurrency) {
    const chunk = photos.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(async (photo: any) => {
      await putSeoSidecar(client, bucket, photo)
    }))
    results.forEach((r) => (r.status === 'fulfilled' ? written++ : failed++))
  }

  return { written, failed }
}

// Removes the sidecar for a photo that is being destroyed. Same key contract as every writer:
// callers pass the raw id and sidecarKey() normalizes it, so a delete can never miss its target.
// S3 DeleteObject succeeds on an already-absent key, so "already gone" is a no-op success rather
// than a NoSuchKey error. Callers own error handling — see processDeletedImage's _deleteUpload.
export async function deleteSeoSidecar (client: S3Client, bucket: string, id: any): Promise<void> {
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: sidecarKey(id)
  }))
}

// Written by the scheduled publisher so the next run knows where its window starts instead of
// guessing a fixed lookback. Lives beside the sidecars it governs.
export const SEO_WATERMARK_KEY = 'seo/_last-run.json'
export const SEO_WATERMARK_FLOOR_HOURS = 48

function isoOrNow (value: any): string {
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString()
}

export async function readSeoWatermark (client: S3Client, bucket: string): Promise<string | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: SEO_WATERMARK_KEY }))
    const body = await res.Body?.transformToString()
    if (body == null) return null
    return isoOrNow(JSON.parse(body)?.lastRunStart)
  } catch (err: any) {
    // NoSuchKey on the first run after deploy is expected, not an incident.
    console.warn('no usable seo watermark', { code: err?.name ?? err?.code })
    return null
  }
}

// Never trust a future or absurdly old watermark: clamp between the floor and now.
export function seoWindowStart (watermark: string | null, nowMs: number): number {
  const floorMs = nowMs - SEO_WATERMARK_FLOOR_HOURS * 60 * 60 * 1000
  const watermarkMs = watermark == null ? NaN : new Date(watermark).getTime()
  if (!Number.isFinite(watermarkMs)) return floorMs
  return Math.max(Math.min(watermarkMs, nowMs), floorMs)
}

export async function writeSeoWatermark (client: S3Client, bucket: string, startedAt: Date): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: SEO_WATERMARK_KEY,
    Body: JSON.stringify({ lastRunStart: startedAt.toISOString(), writtenAt: new Date().toISOString() }),
    ContentType: 'application/json',
    CacheControl: 'max-age=60'
  }))
}
