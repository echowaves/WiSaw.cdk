import psql from "../../psql"
import { traceLog } from '../../utilities/trace'
import { _updatePhotosCount } from "../../controllers/waves/_updatePhotosCount"
import { deleteSeoSidecar } from '../../utilities/seoSidecar'

import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any) {
  const _traceStart = Date.now()
  traceLog('processDeletedImage:START')
  const record = event.Records[0]
  const name = record.s3.object.key
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting name: ${name}`)
  
  try {
  const photoId = name.replace("-thumb", "").replace(".webp", "")
  // we only want to deal with originals
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!deleting image: ${name}`)
  console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!       photoId: ${photoId}`)

  await Promise.all([
    _deleteUpload({ Bucket: record.s3.bucket.name, Key: `${photoId}` }),
    _deleteSidecar({ Bucket: record.s3.bucket.name, photoId }),
    _cleanupTables({ photoId }),
  ])

  // After the objects are gone: without this, img.wisaw.com keeps serving the deleted media and
  // its <id>.json sidecar from edge cache for the full TTL (10 days) even though S3 is clean.
  await _invalidateCdn({ photoId })
  // console.log('everything ended')
  // cb(null, 'success everything')
} catch (err) {
  console.error("Error processing deleted image")
  console.error({ err })  
}
  traceLog('processDeletedImage:END', { duration: `${Date.now() - _traceStart}ms` })
  return true
}

const _deleteUpload = async ({
  Bucket,
  Key,
}: {
  Bucket: string
  Key: string
}) => {
  // console.log(`_deleteUpload started: ${Key}`)

  try {

    const deleteCommand = new DeleteObjectCommand({
      Bucket,
      Key,
    })

    const client = new S3Client({region: 'us-east-1' })

    await client.send(deleteCommand)

  } catch (err) {
    console.error("Error deleting object")
    console.error({ err })
  }
  // console.log(`_deleteUpload ended: ${Key}`)
}

// The <id>.json sidecar must die with the photo it describes, otherwise orphans
// accumulate for every hard delete. Key building lives in seoSidecar.ts; an absent
// sidecar is a no-op success (S3 delete is idempotent). A failure here must never
// fail the handler — same swallow-and-log contract as _deleteUpload above.
const _deleteSidecar = async ({
  Bucket,
  photoId
}: {
  Bucket: string
  photoId: string
}): Promise<void> => {
  try {
    const client = new S3Client({ region: 'us-east-1' })
    await deleteSeoSidecar(client, Bucket, photoId)
  } catch (err) {
    console.error('Error deleting seo sidecar')
    console.error({ err })
  }
}

// One wildcard path per photo. `/<id>*` covers <id>.webp, <id>-thumb.webp, <id>.json and any
// ?query= variant of them (the img distribution caches with queryStringBehavior.all()), and an
// id is a full UUID, so it can only ever match that photo's own keys. The legacy seo/ key is
// still invalidated while pre-root sidecars exist in the bucket and its cache.
function _invalidationPaths (photoId: string): string[] {
  return [`/${photoId}*`, `/seo/${photoId}.json*`]
}

// Best effort like every other step here: an invalidation failure leaves objects cached, it must
// not abort the table cascade or make the S3 event retry forever.
const _invalidateCdn = async ({ photoId }: { photoId: string }): Promise<void> => {
  const distributionId = String(process.env.CLOUD_FRONT_DISTRIBUTION ?? '').trim()
  if (distributionId === '') {
    console.log('No CLOUD_FRONT_DISTRIBUTION configured, skipping CDN invalidation')
    return
  }

  try {
    const paths = _invalidationPaths(photoId)
    const client = new CloudFrontClient({ region: 'us-east-1' })
    await client.send(new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `photo-delete-${photoId}-${Date.now()}`,
        Paths: { Quantity: paths.length, Items: paths }
      }
    }))
  } catch (err) {
    console.error('Error invalidating cloudfront paths')
    console.error({ err })
  }
}

const _cleanupTables = async ({ photoId }: { photoId: string }) => {
  await psql.connect()

  // Delete dependent tables first to satisfy FK constraints (WavePhotos.photoId → Photos.id)
  let affectedWaveUuids: string[] = []
  try {
    const waveResult = await psql.query(`
      SELECT DISTINCT "waveUuid" FROM "WavePhotos"
      WHERE "photoId" = $1
    `, [photoId])
    affectedWaveUuids = waveResult.rows.map((r: any) => r.waveUuid)

    await psql.query(`
      DELETE from "WavePhotos"
      WHERE "photoId" = $1
    `, [photoId])

    for (const waveUuid of affectedWaveUuids) {
      await _updatePhotosCount(waveUuid)
    }
  } catch (err) {
    console.error('Error cleaning up WavePhotos')
    console.error({ err })
  }

  try {
    await psql.query(`
      DELETE from "Watchers"
      WHERE "photoId" = $1
    `, [photoId])
  } catch (err) {
    console.error("Error cleaning up Watchers")
    console.error({ err })
  }

  try {
    await psql.query(`
      DELETE from "Recognitions"
      WHERE "photoId" = $1
    `, [photoId])
  } catch (err) {
    console.error("Error cleaning up Recognitions")
    console.error({ err })
  }

  try {
    await psql.query(`
      DELETE from "Comments"
      WHERE "photoId" = $1
    `, [photoId])
  } catch (err) {
    console.error("Error cleaning up Comments")
    console.error({ err })
  }

  // Delete Photos last — all FK dependencies are now removed
  try {
    await psql.query(`
      DELETE from "Photos"
      WHERE id = $1
    `, [photoId])
  } catch (err) {
    console.error("Error deleting photo")
    console.error({ err })
  }

  await psql.clean()
}
