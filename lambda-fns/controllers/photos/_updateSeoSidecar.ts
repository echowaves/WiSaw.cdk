import { S3Client } from '@aws-sdk/client-s3'

import psql from '../../psql'
import { putSeoSidecar } from '../../utilities/seoSidecar'

// One photo row in exactly the shape buildSeoSidecar expects. Every writer of a sidecar must read
// through here: a partial row overwrites a complete sidecar with a thinner one, which silently
// strips enriched text from an already-indexed page. The address columns are selected for the
// place name and "location" (the geography column) is deliberately never published.
const PHOTO_SEO_QUERY = `
  SELECT
    p.*,
    COALESCE(r."labels", '[]'::jsonb) AS "labels"
  FROM "Photos" p
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(l ->> 'Name') AS "labels"
    FROM "Recognitions" rec,
         -- Older Rekognition payloads store Labels as a scalar; unwinding one of those
         -- aborts the whole statement (22023) and takes the caller's job with it.
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(rec."metaData" -> 'Labels') = 'array'
                THEN rec."metaData" -> 'Labels'
                ELSE '[]'::jsonb END
         ) l
    WHERE rec."photoId" = p."id"
      AND coalesce(l ->> 'Name', '') <> ''
  ) r ON true
  WHERE p."id" = $1
    AND p."active" = true
  LIMIT 1
`

// The active filter is what keeps a photo deleted mid-edit from getting its sidecar resurrected.
export async function loadSeoPhotoRow (photoId: string): Promise<any | null> {
  await psql.connect()
  try {
    const result = await psql.query(PHOTO_SEO_QUERY, [photoId])
    return result.rows.length > 0 ? result.rows[0] : null
  } finally {
    await psql.clean()
  }
}

// Refreshes <id>.json after an edit that changes SEO text (a comment added or removed). Runs on a
// best-effort basis: losing the enrichment until the next scheduled publisher run is acceptable,
// failing the user's mutation is not. The publisher stays the backstop for every missed write.
export async function _updateSeoSidecar (photoId: string): Promise<void> {
  try {
    const bucket = String(process.env.S3_BUCKET ?? '').trim()
    if (bucket === '') {
      console.warn('No S3_BUCKET configured, skipping seo sidecar refresh')
      return
    }

    const photo = await loadSeoPhotoRow(photoId)
    if (photo == null) {
      console.log('Skipping seo sidecar refresh: no active photo row', { photoId })
      return
    }

    await putSeoSidecar(new S3Client({ region: 'us-east-1' }), bucket, photo)
  } catch (err) {
    console.error('Error refreshing seo sidecar', { photoId, err })
  }
}
