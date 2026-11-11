import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

import psql from '../../psql'
import { pickVideoObjectKey } from '../../lambdas/injectMetaTagsLambdaFunction/mediaNaming'
// The container parser stays plain CommonJS so the edge bundle could load it too; the .d.ts beside
// it is what gives this file its types (same arrangement as mediaNaming / seoRules).
import { durationFromContainer } from '../../utilities/videoDuration.js'

// How a video row gets a real duration.
//
// The mobile app never reports one and production objects carry no upload-time metadata, so the
// number has to be read out of the stored container (see utilities/videoDuration.js for why the
// alternatives are guesses). Learning it costs one HEAD plus up to two ranged GETs per video, which
// is affordable exactly once per row - so it happens where a sidecar is about to be written, and the
// answer is persisted next to the other facts about the media rather than recomputed per request.

const DEFAULT_CONCURRENCY = 8
const PROBE_WINDOW_BYTES = 32

interface DurationSource {
  size: number
  read: (offset: number, length: number) => Promise<Buffer>
}

/** Optional out-parameter so a caller can report what a probe actually cost. */
export interface ProbeStats {
  bytes: number
  reads: number
}

/** @returns the seconds stored in this object's container, or null when it does not say. */
export async function probeVideoDuration (client: S3Client, bucket: string, key: string, stats?: ProbeStats): Promise<number | null> {
  const source: DurationSource = {
    size: 0,
    read: async (offset: number, length: number): Promise<Buffer> => {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${offset}-${offset + length - 1}` }))
      const bytes = await res.Body?.transformToByteArray()
      if (stats != null) {
        stats.reads += 1
        stats.bytes += bytes?.length ?? 0
      }
      return Buffer.from(bytes ?? new Uint8Array())
    }
  }

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    source.size = Number(head.ContentLength ?? 0)
    if (!(source.size > PROBE_WINDOW_BYTES)) return null
    return await durationFromContainer(source)
  } catch (err: any) {
    // A missing or unreadable object is not evidence about length; the row simply stays unknown.
    console.warn('video duration probe failed', { key, code: err?.name ?? err?.code })
    return null
  }
}

/**
 * The stored object for a media id. The API and the database only know the id, while uploads have
 * always kept whatever extension the phone chose, so the bucket is asked rather than assumed.
 */
export async function videoKeyForId (client: S3Client, bucket: string, id: any): Promise<string> {
  try {
    const { Contents = [] } = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${String(id).toLowerCase()}.`, MaxKeys: 8 }))
    return pickVideoObjectKey(String(id).toLowerCase(), Contents.map((obj) => obj.Key ?? ''))
  } catch (err: any) {
    console.warn('video key lookup failed', { id, code: err?.name ?? err?.code })
    return pickVideoObjectKey(String(id).toLowerCase(), [])
  }
}

// Deliberately leaves "updatedAt" alone: bumping it would push every touched video back into the
// sidecar refresh window on each scheduled run, which is churn the job pays for with no new content.
export const STORE_DURATION_SQL = 'UPDATE "Photos" SET "duration" = $2 WHERE "id" = $1'

/** Reads one row's container; returns the seconds, or null when the file does not say. */
export async function probeRowDuration (client: S3Client, bucket: string, row: any): Promise<number | null> {
  if (row?.video !== true || row?.duration != null) return null
  const key = await videoKeyForId(client, bucket, row.id)
  return await probeVideoDuration(client, bucket, key)
}

/**
 * Stores learned durations. One connection for the whole batch because psql is a shared client:
 * connecting per row would race other callers of the same module inside one invocation.
 */
export async function storeDurations (pairs: Array<{ id: any, seconds: number }>): Promise<void> {
  if (pairs.length === 0) return
  await psql.connect()
  try {
    for (const pair of pairs) {
      await psql.query(STORE_DURATION_SQL, [pair.id, pair.seconds])
    }
  } finally {
    await psql.clean()
  }
}

/** Reads one row's container and stores what it finds; returns the seconds, or null. */
export async function learnRowDuration (client: S3Client, bucket: string, row: any): Promise<number | null> {
  const seconds = await probeRowDuration(client, bucket, row)
  if (seconds == null) return null

  await storeDurations([{ id: row.id, seconds }])
  // The caller builds this row's SEO record from the same object, so the value it just stored has
  // to be visible there without a second read.
  row.duration = seconds
  return seconds
}

// The upload processor knows only the media id, and must not pay for a full SEO row read just to
// ask whether this row is an unmeasured video.
const ROW_STATE_SQL = 'SELECT "id", "video", "duration" FROM "Photos" WHERE "id" = $1 LIMIT 1'

/**
 * Learns one media id's length from its stored object. Used by upload processing, where the event
 * can carry a still poster rather than the video: the number always comes from the stored video
 * object for this id, never from the bytes that triggered processing. Returns null - and touches
 * nothing - when the row is not a video or already states a length.
 */
export async function learnDurationForId (client: S3Client, bucket: string, photoId: any): Promise<number | null> {
  await psql.connect()
  let rows: any[]
  try {
    rows = (await psql.query(ROW_STATE_SQL, [photoId])).rows
  } finally {
    await psql.clean()
  }

  const row = rows[0]
  if (row?.video !== true || row.duration != null) return null
  return await learnRowDuration(client, bucket, row)
}

export interface LearnVideoDurationsOptions {
  bucket: string
  client?: S3Client
  concurrency?: number
  /** Caps the work per invocation; the next run picks up where this one stopped. */
  limit?: number
}

export interface LearnVideoDurationsResult {
  checked: number
  learned: any[]
  failed: number
}

/**
 * Learns durations for the video rows in a feed that do not have one yet. Rows are mutated in place
 * and the learned ones are returned, so a caller can publish their sidecars in the same run instead
 * of waiting for a later pass to notice the new value.
 */
export async function learnVideoDurations (rows: any[], options: LearnVideoDurationsOptions): Promise<LearnVideoDurationsResult> {
  const bucket = String(options.bucket ?? '').trim()
  if (bucket === '') return { checked: 0, learned: [], failed: 0 }

  const candidates = (rows ?? [])
    .filter((row: any) => row?.video === true && row?.duration == null && row?.id != null)
    .slice(0, options.limit ?? Number.POSITIVE_INFINITY)
  if (candidates.length === 0) return { checked: 0, learned: [], failed: 0 }

  const client = options.client ?? new S3Client({ region: 'us-east-1' })
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY)
  const learned: any[] = []
  let failed = 0

  for (let i = 0; i < candidates.length; i += concurrency) {
    const chunk = candidates.slice(i, i + concurrency)
    const results = await Promise.allSettled(chunk.map(async (row: any) => await probeRowDuration(client, bucket, row)))

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1
        return
      }
      const seconds = result.value
      const row = chunk[index]
      if (seconds == null) return
      // Mutated before the write so a caller that publishes this row's sidecar in the same run
      // publishes the value it just learned, not the absence of one.
      row.duration = seconds
      learned.push(row)
    })
  }

  try {
    await storeDurations(learned.map((row: any) => ({ id: row.id, seconds: Number(row.duration) })))
  } catch (err) {
    // The values are already on the rows for this run's records; a lost write means the next pass
    // re-reads those containers, which costs probes rather than correctness.
    console.error('storing learned durations failed', { err })
    failed += learned.length
  }

  return { checked: candidates.length, learned, failed }
}
