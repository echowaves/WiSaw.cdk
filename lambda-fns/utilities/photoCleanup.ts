import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { sidecarKey } from './seoSidecar'

// A soft delete (Photos.active = false) leaves the media serving by direct URL forever: the
// original ${id}.webp, ${id}-thumb.webp, ${id}.mov and the seo/<lower-id>.json sidecar all stay
// in wisaw-img-<env>, and the only cleanup that used to exist fired on a thumb OBJECT_REMOVED
// event nothing in the app produces. This module is that missing cleanup: given a photo id it
// removes every object shape that id can own and invalidates their public CDN paths once.
//
// Contracts that must not drift:
//   - Key shapes come from lambda-fns/models/photo.ts (bucket-root media) plus sidecarKey()
//     (lowercase id under seo/). Ids are normalized to lowercase ONCE here, so a caller that
//     passes an uppercase UUID still hits the real objects instead of inventing new ones.
//   - Only these exact keys are deleted. No prefix sweeps: a sibling photo whose id shares a
//     prefix must never be touched (see tests/photo-delete-cleanup.js).
//   - Invalidation paths are wildcarded (`/<key>*`) because the img distribution caches with
//     queryStringBehavior.all() + cookieBehavior.all() and a fixed 10-day TTL
//     (lib/resources/cloud-front.ts), so every ?query=variant is its own cached object.
//   - The whole operation is bounded by a deadline well inside wisawFn's 30 s timeout
//     (lib/resources/lambdas.ts) and NEVER throws: a cleanup problem must not turn a successful
//     soft delete into an AppSync error, it just leaves objects behind for reconciliation.

const CLEANUP_DEADLINE_MS = 15000
// Part of the total budget held back for the invalidation, so a deadline stop in the delete pass
// still gets to purge what it already removed instead of leaving those copies at the edge for the
// rest of the distribution's 10-day TTL.
const INVALIDATION_RESERVE_MS = 3000
const CLEANUP_REGION = 'us-east-1'
const DEADLINE_ERROR = 'deadline-exceeded'

export interface CleanupClient {
  send: (command: any) => Promise<any>
}

export interface PhotoCleanupOptions {
  bucket: string
  distributionId?: string
  /** Injected for tests/reuse; real SDK clients are built on demand when omitted. */
  s3?: CleanupClient
  cloudfront?: CleanupClient
  deadlineMs?: number
}

export interface PhotoCleanupFailure {
  key: string
  error: string
}

export type InvalidationOutcome = 'issued' | 'skipped-no-distribution' | 'skipped-deadline' | 'failed'

export interface PhotoCleanupResult {
  keys: string[]
  deleted: string[]
  failures: PhotoCleanupFailure[]
  invalidation: InvalidationOutcome
  paths: string[]
  stoppedAtDeadline: boolean
  elapsedMs: number
}

/** Media and sidecar objects live under lowercase UUIDs; normalize once, then derive keys. */
function _normalizeId (photoId: any): string {
  return String(photoId ?? '').trim().toLowerCase()
}

/** Every object key a photo id can own, in delete order (media first, sidecar last). */
export function photoObjectKeys (photoId: any): string[] {
  const id = _normalizeId(photoId)
  return [`${id}.webp`, `${id}-thumb.webp`, `${id}.mov`, sidecarKey(id)]
}

/** Public CDN paths for those keys, wildcarded to cover query-string/cookie cache variants. */
export function invalidationPaths (keys: string[]): string[] {
  return keys.map((key) => `/${key}*`)
}

// S3 DeleteObject answers success for an absent key, so this is a belt-and-braces mapping of the
// NoSuchKey/NotFound shapes the SDK can surface, not the normal path.
function isAbsent (err: any): boolean {
  const code = String(err?.name ?? err?.Code ?? err?.code ?? '')
  return code === 'NoSuchKey' || code === 'NotFound'
}

interface SendOutcome { ok: boolean, error?: string }

async function _send (client: CleanupClient, command: any): Promise<SendOutcome> {
  try {
    await client.send(command)
    return { ok: true }
  } catch (err: any) {
    if (isAbsent(err)) return { ok: true }
    return { ok: false, error: String(err?.message ?? err) }
  }
}

// Resolves with the send's outcome, or with a deadline marker if the call is still in flight when
// the budget runs out. The work promise never rejects (see _send), so losing the race cannot leak
// an unhandled rejection when the SDK call settles later.
async function _raceDeadline (work: Promise<SendOutcome>, remainingMs: number): Promise<SendOutcome> {
  const outcome = await new Promise<SendOutcome>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ok: false, error: DEADLINE_ERROR })
    }, Math.max(0, remainingMs))
    // Never let a pending guard keep the process alive after the response is sent.
    const guard = timer as any
    if (typeof guard.unref === 'function') guard.unref()
    void work.then((settledOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(settledOutcome)
    })
  })
  return outcome
}

interface DeletePassResult { deleted: string[], failures: PhotoCleanupFailure[], stoppedAtDeadline: boolean }

async function _deleteKeys (s3: CleanupClient, bucket: string, keys: string[], budgetMs: number, startedAt: number): Promise<DeletePassResult> {
  const deleted: string[] = []
  const failures: PhotoCleanupFailure[] = []

  for (const key of keys) {
    const remaining = budgetMs - (Date.now() - startedAt)
    if (remaining <= 0) return { deleted, failures, stoppedAtDeadline: true }

    const outcome = await _raceDeadline(_send(s3, new DeleteObjectCommand({ Bucket: bucket, Key: key })), remaining)
    if (outcome.ok) {
      deleted.push(key)
      continue
    }
    if (outcome.error === DEADLINE_ERROR) return { deleted, failures, stoppedAtDeadline: true }
    const failure = { key, error: outcome.error ?? 'unknown' }
    failures.push(failure)
    // Logged per key so a partial purge can be reconciled by hand afterwards.
    console.error('photoCleanup: delete failed', { bucket, ...failure })
  }

  return { deleted, failures, stoppedAtDeadline: false }
}

async function _invalidate (cloudfront: CleanupClient, distributionId: string, paths: string[], callerReference: string): Promise<SendOutcome> {
  // One batch per cleanup: CloudFront accepts up to 100 paths, and a deadline-stopped pass submits
  // only the keys it managed to delete.
  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: callerReference,
      Paths: { Quantity: paths.length, Items: paths }
    }
  })
  const outcome = await _send(cloudfront, command)
  return outcome
}

/**
 * Deletes every object shape for `photoId` in `opts.bucket` and issues one wildcarded
 * CloudFront invalidation when a distribution id is configured. Never throws; the returned
 * result is for logging/reconciliation only.
 */
export async function removePhotoObjects (photoId: any, opts: PhotoCleanupOptions): Promise<PhotoCleanupResult> {
  const startedAt = Date.now()
  const deadlineMs = opts.deadlineMs ?? CLEANUP_DEADLINE_MS
  const bucket = String(opts.bucket ?? '').trim()
  const distributionId = String(opts.distributionId ?? '').trim()
  const keys = photoObjectKeys(photoId)
  const paths = invalidationPaths(keys)

  const result: PhotoCleanupResult = {
    keys,
    deleted: [],
    failures: [],
    invalidation: 'skipped-no-distribution',
    paths,
    stoppedAtDeadline: false,
    elapsedMs: 0
  }

  try {
    if (bucket === '') {
      console.error('photoCleanup: no media bucket configured, skipping cleanup', { keys })
      return finish(result, startedAt)
    }

    const s3 = opts.s3 ?? new S3Client({ region: CLEANUP_REGION })
    // Deletes run inside the budget minus the reserve, and the reserve is capped so a short total
    // budget never starves the delete pass.
    const reserveMs = Math.min(INVALIDATION_RESERVE_MS, Math.floor(deadlineMs / 4))
    const pass = await _deleteKeys(s3, bucket, keys, deadlineMs - reserveMs, startedAt)
    result.deleted = pass.deleted
    result.failures = pass.failures
    result.stoppedAtDeadline = pass.stoppedAtDeadline

    if (pass.stoppedAtDeadline && pass.deleted.length === 0) {
      result.invalidation = 'skipped-deadline'
      console.error('photoCleanup: cleanup deadline reached before anything was deleted, invalidation skipped', { bucket, failures: pass.failures })
      return finish(result, startedAt)
    }

    if (distributionId === '') {
      console.log('photoCleanup: no CloudFront distribution configured, invalidation skipped', { bucket, deleted: pass.deleted })
      return finish(result, startedAt)
    }

    // Only what was actually removed needs purging; after a deadline stop that is the deleted
    // subset, and it still gets its one wildcarded invalidation inside the reserved slice.
    if (pass.stoppedAtDeadline) {
      console.error('photoCleanup: cleanup deadline reached, invalidating only the objects already removed', { bucket, deleted: pass.deleted })
    }
    const submitted = invalidationPaths(pass.deleted)
    result.paths = submitted

    const cloudfront = opts.cloudfront ?? new CloudFrontClient({ region: CLEANUP_REGION })
    // CallerReference must be unique per batch; the id plus a timestamp and a salt keeps two
    // concurrent deletes of the same photo from colliding on it.
    const reference = `wisaw-${_normalizeId(photoId)}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const invalidation = await _raceDeadline(_invalidate(cloudfront, distributionId, submitted, reference), Math.max(0, deadlineMs - (Date.now() - startedAt)))

    if (invalidation.ok) result.invalidation = 'issued'
    else if (invalidation.error === DEADLINE_ERROR) {
      result.invalidation = 'skipped-deadline'
      console.error('photoCleanup: CloudFront invalidation ran out of budget', { distributionId, paths: submitted })
    } else {
      result.invalidation = 'failed'
      console.error('photoCleanup: CloudFront invalidation failed', { distributionId, paths: submitted, error: invalidation.error })
    }
    return finish(result, startedAt)
  } catch (err: any) {
    // Defensive only: every SDK call above is already wrapped. Cleanup must never throw.
    console.error('photoCleanup: unexpected cleanup failure', { keys, err: String(err?.message ?? err) })
    return finish(result, startedAt)
  }
}

function finish (result: PhotoCleanupResult, startedAt: number): PhotoCleanupResult {
  result.elapsedMs = Date.now() - startedAt
  console.log('photoCleanup:done', {
    deleted: result.deleted.length,
    failures: result.failures.length,
    invalidation: result.invalidation,
    deadline: result.stoppedAtDeadline,
    ms: result.elapsedMs
  })
  return result
}
