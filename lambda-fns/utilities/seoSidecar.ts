import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'

// One sidecar per photo/video, read by Lambda@Edge, which cannot join the VPC to reach
// Postgres. The shape is a contract with the edge injector (see
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js and seoText.js) and is pinned by
// tests/seo-sidecar-shape.js - changing a field here without updating the reader silently
// degrades every photo page, which is exactly the class of bug that once cost ~22k pages their
// index. Every writer must go through buildSeoSidecar so the three call sites cannot drift.

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

export function locationText (row: any): string {
  return [row?.locality, row?.district, row?.region]
    .map((part) => clean(part))
    .filter(Boolean)
    // "Brooklyn, New York" reads well; a repeated place name does not.
    .filter((part: string, i: number, all: string[]) => all.indexOf(part) === i)
    .join(', ')
}

// Tolerates partial rows: a photo that has no labels or place yet yields empty fields rather
// than throwing. Callers that only hold a few columns (the comment path, for instance) must
// still load the full row first, otherwise they overwrite a complete sidecar with a thinner one.
export function buildSeoSidecar (photo: any): SeoSidecar {
  const createdMs = photo?.createdAt == null ? NaN : new Date(photo.createdAt).getTime()
  return {
    v: SEO_SIDECAR_VERSION,
    caption: clean(photo?.lastComment).slice(0, 200),
    labels: pickLabels([photo]),
    // An unreadable createdAt yields an empty field rather than throwing mid-batch.
    created: Number.isFinite(createdMs) ? new Date(createdMs).toISOString() : '',
    location: locationText(photo),
    width: clean(photo?.width),
    height: clean(photo?.height)
  }
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
