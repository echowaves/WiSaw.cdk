import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { deleteSeoSidecar, sidecarKey } from '../../utilities/seoSidecar'
import { _updatePhotosCount } from '../waves/_updatePhotosCount'

// The object shapes a photo id owns in wisaw-img-<env>: the original, the thumb, and the video.
// Ids are lowercased once here because bucket keys follow the lowercase-UUID convention
// (same as scripts/cleanup-s3.js and seoSidecar.sidecarKey). Only these exact keys are ever
// deleted — no prefix sweeps, so a sibling photo sharing an id prefix is never touched.
export function photoObjectKeys (photoId: string): string[] {
  const id = String(photoId).toLowerCase()
  return [`${id}.webp`, `${id}-thumb.webp`, `${id}.mov`]
}

// Invalidation paths are wildcarded (`/<key>*`): the img distribution caches with
// queryStringBehavior.all() + cookieBehavior.all() and a fixed 10-day TTL
// (lib/resources/cloud-front.ts), so every ?query=variant is its own cached object and an
// exact-path invalidation would leave those copies serving a deleted photo for days.
function cdnInvalidationPaths (photoId: string): string[] {
  return [...photoObjectKeys(photoId), sidecarKey(photoId)].map((key) => `/${key}*`)
}

async function _deleteObjects (client: any, bucket: string, keys: string[]): Promise<void> {
  for (const Key of keys) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))
    } catch (err) {
      console.error(`deletePhoto: failed to delete ${Key}`, { err })
    }
  }
}

async function _invalidateCdn (client: any, distributionId: string, paths: string[]): Promise<void> {
  try {
    await client.send(new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `photo-delete-${Date.now()}`,
        Paths: { Quantity: paths.length, Items: paths }
      }
    }))
  } catch (err) {
    console.error('deletePhoto: CDN invalidation failed', { err })
  }
}

// Extra cleanup steps after the soft delete: remove every object the photo owns (original,
// thumb, video, seo sidecar) and invalidate their public CDN paths. Deleting the thumb also
// fires the bucket's OBJECT_REMOVED notification, so the existing processDeletedImage
// procedure still runs its cascade — that handler stays the single owner of table cleanup;
// this only handles storage and the edge cache. Every step is guarded: a cleanup problem
// must never turn a successful soft delete into an AppSync error, it just leaves objects
// behind for reconciliation. Clients are injectable for tests.
export async function cleanupPhotoObjects (
  photoId: string,
  deps: { bucket?: string, distributionId?: string, s3?: any, cloudfront?: any } = {}
): Promise<void> {
  try {
    const bucket = String(deps.bucket ?? process.env.S3_BUCKET ?? '').trim()
    if (bucket === '') {
      console.warn('deletePhoto: no media bucket configured, object cleanup skipped')
      return
    }

    const s3 = deps.s3 ?? new S3Client({ region: 'us-east-1' })
    await _deleteObjects(s3, bucket, photoObjectKeys(photoId))

    try {
      await deleteSeoSidecar(s3, bucket, photoId)
    } catch (err) {
      console.error('deletePhoto: failed to delete seo sidecar', { err })
    }

    const distributionId = String(deps.distributionId ?? process.env.CLOUD_FRONT_DISTRIBUTION ?? '').trim()
    if (distributionId === '') return // environments without a CDN id simply skip the invalidation
    const cloudfront = deps.cloudfront ?? new CloudFrontClient({ region: 'us-east-1' })
    await _invalidateCdn(cloudfront, distributionId, cdnInvalidationPaths(photoId))
  } catch (err) {
    console.error('deletePhoto: photo object cleanup failed', { err })
  }
}

export default async function main (photoId: string, uuid: string): Promise<string> {
  // const createdAt = dayjs().toISOString()
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  // Check if photo is in a frozen wave, with role awareness for owner override
  const frozenCheck = await psql.query(`
    SELECT w."waveUuid", wu."role"
    FROM "WavePhotos" wp
    JOIN "Waves" w ON w."waveUuid" = wp."waveUuid"
    LEFT JOIN "WaveUsers" wu ON wu."waveUuid" = w."waveUuid" AND wu."uuid" = $2
    WHERE wp."photoId" = $1
      AND (
        w."freezeMode" = 'FROZEN'
        OR (
          w."freezeMode" = 'AUTO'
          AND (NOW() < w."splashDate" OR NOW() > w."freezeDate")
        )
      )
  `, [photoId, uuid])

  if (frozenCheck.rows.length > 0 && frozenCheck.rows[0].role !== 'owner') {
    await psql.clean()
    throw new Error('Cannot delete a photo that is in a frozen wave')
  }

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = $1
    `, [photoId])

  // Update wave photosCount if photo was in a wave
  const waveResult = await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])
  if (waveResult.rows.length > 0) {
    await _updatePhotosCount(waveResult.rows[0].waveUuid)
  }

  await psql.clean()

  // The DB row is already soft-deleted at this point, so cleanup runs last and cannot affect
  // the response.
  await cleanupPhotoObjects(photoId)

  return 'OK'
}
