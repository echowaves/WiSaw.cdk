import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import type { S3Client } from '@aws-sdk/client-s3'

import { SIDECAR_VERSION, buildSeoRecord } from '../lambdas/injectMetaTagsLambdaFunction/seoRules.js'

// The text rules are no longer mirrored here: they live in one module (seoRules.js) that the edge
// can load straight out of its zipped folder, and this file imports them like anything else. These
// names stay re-exported because callers - the sitemap job, the comment path, plain tests - already
// reach for them through this module.
export {
  IMAGE_CAPTION_MAX,
  IMAGE_TITLE_MAX,
  PRECISE_KEYS,
  assertNoPreciseLocation,
  clean,
  identityTitle,
  isPreciseLocation,
  locationText,
  monthYear,
  pickLabels,
  splitImageText,
  truncateWords
} from '../lambdas/injectMetaTagsLambdaFunction/seoRules.js'

// One sidecar per photo/video, read by Lambda@Edge, which cannot join the VPC to reach
// Postgres. The shape is a contract with the edge injector (see
// lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js and seoText.js); tests/seo-crawler-contract.js
// pins the fields that reader consumes, so change both sides in one commit - dropping a field here
// without updating the reader silently degrades every photo page, which is exactly the class of bug
// that once cost ~22k pages their index. Every writer must go through buildSeoSidecar so call sites
// cannot drift.
//
// These objects are public: <id>.json sits in the media bucket behind img.wisaw.com, so
// anyone who has a photo URL can read one. A place NAME is fair page content ("Coney Island,
// New York" is what makes a photo rankable), but a COORDINATE is not - it pinpoints where a
// person stood, and once crawled from a guessable URL it cannot be unpublished. Everything
// here therefore derives from the address columns, never from "Photos"."location", and
// assertNoPreciseLocation refuses to build anything that looks like a coordinate anyway.

export const SEO_SIDECAR_VERSION = SIDECAR_VERSION

/**
 * Finished crawler-facing strings, computed once by the writer. The edge and the app render these
 * instead of composing their own text, which is what makes first byte and hydrated head match.
 * `kind` is part of the contract: a record describes one media type, so a page rendered under the
 * other path derives its strings instead of wearing someone else's title.
 */
export interface SeoStrings {
  kind: string
  title: string
  description: string
  imageTitle: string
  imageCaption: string
}

export interface SeoSidecar {
  v: number
  caption: string
  labels: string[]
  created: string
  location: string
  width: string
  height: string
  seo: SeoStrings
}

// Tolerates partial rows: a photo that has no labels or place yet yields empty fields rather
// than throwing. Callers that only hold a few columns (the comment path, for instance) must
// still load the full row first, otherwise they overwrite a complete sidecar with a thinner one.
// A row may carry a "location" geometry column; it is ignored here and rejected by the guard.
export function buildSeoSidecar (photo: any): SeoSidecar {
  return buildSeoRecord(photo) as SeoSidecar
}

export interface ImageTextPair { title: string, caption: string }

// The sidecar lives next to the media it describes: <id>.json at the bucket root, with no
// separate prefix. One key shape means one rule for writers, readers, CDN invalidations and
// the cleanup-s3 reconciler (which already classifies any <uuid>.* key by its photo).
export function sidecarKey (id: any): string {
  return `${String(id).toLowerCase()}.json`
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
// guessing a fixed lookback. It keeps its seo/ prefix (photo sidecars moved to the bucket root):
// cleanup-s3 classifies it as "report only", so no reconciler can delete the job's own state.
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
