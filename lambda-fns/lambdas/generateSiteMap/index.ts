const { SitemapStream, streamToPromise } = require("sitemap")

import psql from "../../psql"
import { traceLog } from '../../utilities/trace'

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"; // ES Modules import
import { ListObjectsV2Command } from "@aws-sdk/client-s3"

import { locationText, putSeoSidecars, readSeoWatermark, seoWindowStart, splitImageText, writeSeoWatermark } from '../../utilities/seoSidecar'

// The naming rule lives with the edge injector because that bundle is deployed as a raw folder
// zip (Code.fromAsset) and cannot reach outside it; this lambda is bundled by esbuild, so it can
// import across folders. One module decides what a media file is called for both surfaces — the
// sitemap entry and the page head can no longer name different files.
import { imageObjectKey, imgUrl, isVideoObjectKey, pickVideoObjectKey, thumbnailObjectKey } from '../../lambdas/injectMetaTagsLambdaFunction/mediaNaming'

// Only photos touched since the last successful run get a fresh sidecar; without a window the
// job would issue ~22k PUTs every five hours for content that almost never changes.
const SIDECAR_CONCURRENCY = 20
// A backfill pass writes ~22k objects inside one 120s invocation; at the incremental
// concurrency that does not fit, so the one-off path is allowed to be louder.
const BACKFILL_CONCURRENCY = 60

function recentlyTouched (photos: any[], windowStartMs: number): any[] {
  return photos.filter((photo: any) => {
    const touchedAt = new Date(photo?.updatedAt ?? 0).getTime()
    return Number.isFinite(touchedAt) && touchedAt >= windowStartMs
  })
}

// Which photos to refresh is decided by the last successful run's start rather than a fixed
// guess: the old six-hour window only had an hour of slack against the five-hour cadence, so
// two skipped runs silently lost coverage for everything touched in between. Extracted so
// main() keeps one line for the whole sidecar path.
async function publishSidecars (client: S3Client, bucket: string, photos: any[], backfill: boolean): Promise<void> {
  const nowMs = Date.now()
  const watermark = backfill ? null : await readSeoWatermark(client, bucket)
  const windowStart = seoWindowStart(watermark, nowMs)
  const candidates = backfill ? photos : recentlyTouched(photos, windowStart)
  console.log('sidecar candidates:', candidates.length, 'backfill:', backfill, 'windowStart:', new Date(windowStart).toISOString())

  if (candidates.length === 0) return

  const concurrency = backfill ? BACKFILL_CONCURRENCY : SIDECAR_CONCURRENCY
  const { written, failed } = await putSeoSidecars(client, bucket, candidates, concurrency)
  console.log(`sidecars written=${written} failed=${failed}`)

  // A run that dropped writes must leave the old watermark alone so its window is retried;
  // advancing past a photo whose PUT failed would lose it until something else touched it.
  if (written > 0 && failed === 0) {
    await writeSeoWatermark(client, bucket, new Date(nowMs))
  } else {
    console.warn('sidecar watermark not advanced', { written, failed })
  }
}

/**
 * Stored video keys grouped by media id, from one pass over the media bucket.
 *
 * The sitemap used to publish `<id>.mov` without looking: correct while every upload happened to
 * use that extension, a 404 for search engines the moment one does not — and a page whose head
 * advertises a different file than its own sitemap entry is worse than either. A full listing is
 * ~45 paginated calls for the whole corpus (66k objects) and only video keys are retained, so it
 * costs seconds against the 120s budget instead of one HEAD per video.
 */
async function listStoredVideoKeys (client: S3Client, bucket: string): Promise<Map<string, string[]>> {
  const byId = new Map<string, string[]>()
  let token: string | undefined

  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: 1000 }))
    for (const obj of page.Contents ?? []) {
      if (!isVideoObjectKey(obj.Key)) continue
      const id = obj.Key.slice(0, obj.Key.lastIndexOf('.'))
      const keys = byId.get(id) ?? []
      keys.push(obj.Key)
      byId.set(id, keys)
    }
    token = page.IsTruncated === true ? page.NextContinuationToken : undefined
  } while (token !== undefined && token !== '')

  return byId
}

// eslint-disable-next-line import/prefer-default-export
export async function main (event: any = {}, context: any /*, cb: any*/) {
  const _traceStart = Date.now()
  traceLog('generateSiteMap:START')
  const smStream = new SitemapStream({ hostname: "https://wisaw.com" })
  smStream.write({ url: "/", changefreq: "daily" })
  smStream.write({ url: "/about" })
  smStream.write({ url: "/contact"})
  smStream.write({ url: "/terms" })


  let videos, photos: any[] | undefined
  
  await psql.connect()


  // retrieve photos
  try {
    photos = (
      await psql.query(`  
        SELECT
          p.*,
          COALESCE(r."labels", '[]'::jsonb) AS "labels"
        FROM "Photos" p
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(l ->> 'Name') AS "labels"
          FROM "Recognitions" rec,
               -- Older Rekognition payloads store Labels as a scalar; unwinding one of those
               -- aborts the whole statement (22023) and took the photo feed with it.
               jsonb_array_elements(
                 CASE WHEN jsonb_typeof(rec."metaData" -> 'Labels') = 'array'
                      THEN rec."metaData" -> 'Labels'
                      ELSE '[]'::jsonb END
               ) l
          WHERE rec."photoId" = p."id"
            AND coalesce(l ->> 'Name', '') <> ''
        ) r ON true
        WHERE
            p.active = true      
        ORDER BY p."updatedAt" DESC
        LIMIT 30000
      `)
    ).rows
  } catch (err) {
    console.error("Unable to retrieve Photos feed", { err })
    // return false
  }

  await psql.clean()

  console.log('photos.length:', photos?.length)
  // console.log('videos.length:', videos.length)

  // Never overwrite a good sitemap with an empty one. A failed feed used to fall through to
  // the PUT and publish a four-URL file over ~21k indexed pages; the last good file is worth
  // more than a fresh blank one, so bail before anything is written.
  if (photos == null || photos.length === 0) {
    console.error('Aborting before upload: photo feed unavailable, keeping existing sitemap.xml')
    traceLog('generateSiteMap:ABORT', { reason: 'empty-photo-feed' })
    return false
  }

  // One listing for the whole run: a permission error or a throttled answer must not cost the
  // site its sitemap, so an unavailable lookup falls back to the naming rule and says so.
  const imgBucketName = process.env.S3_IMAGES_BUCKET || 'wisaw-img-prod'
  let storedVideoKeys = new Map<string, string[]>()
  try {
    storedVideoKeys = await listStoredVideoKeys(new S3Client({ region: 'us-east-1' }), imgBucketName)
    console.log('stored video keys:', storedVideoKeys.size)
  } catch (err) {
    console.error('video key listing unavailable, falling back to the naming rule', { err })
  }
  let unresolvedVideos = 0
  const videoFileKey = (id: string): string => {
    const keys = storedVideoKeys.get(id)
    if (keys === undefined || keys.length === 0) unresolvedVideos += 1
    return pickVideoObjectKey(id, keys ?? [])
  }


  photos?.forEach((photo: any) => {
    // const jsonObj = JSON.parse(JSON.stringify(photo))
    // lastmod is what tells Google a URL is worth re-crawling. A sitemap of 21k URLs with no
    // dates gets polled rarely, which kept deep pages out of the index long after the
    // canonical fix landed.
    const lastmod = photo?.updatedAt ? new Date(photo.updatedAt).toISOString() : undefined
    // Two texts rather than one: the tags label the image, the newest comment captions it. They
    // only coincide when a photo has no comment - see splitImageText for the reasoning.
    const { title, caption } = splitImageText(photo, photo.video ? 'video' : 'photo')
    const createdAt = photo.createdAt ? new Date(photo.createdAt).toISOString() : undefined

    if(photo?.video === true) {
      smStream.write({ url: `/videos/${photo.id}`,
      lastmod,
      video: [
        {
          thumbnail_loc: imgUrl(thumbnailObjectKey(photo.id)),
          title,
          // A video has a description rather than a caption slot, but it follows the same rule and
          // the same limit: the comment captions it, the tags never do.
          description: caption,
          // The object that exists; `<id>.mov` only when storage had nothing for this id.
          content_loc: imgUrl(videoFileKey(photo.id)),
          publication_date: createdAt,
          family_friendly: true
        }
        ] 
      })
    } else {
      // Google Image Search is the realistic growth channel for a photo site, and it can only
      // use images declared here - 21k photo URLs previously carried zero image entries.
      smStream.write({
        url: `/photos/${photo.id}`,
        lastmod,
        img: [
          {
            url: imgUrl(imageObjectKey(photo.id)),
            title,
            caption,
            geoLocation: locationText(photo) || undefined,
            license: 'https://wisaw.com/terms'
          }
        ]
      })
    }
  })

  if (unresolvedVideos > 0) {
    console.warn('videos with no stored object found, published under the default extension', { unresolvedVideos })
  }

  smStream.end()
  const buffer = await streamToPromise(smStream)

  // download the original to disk
  
  try {
    console.log('uploading sitemap.xml')

      const client = new S3Client({region: 'us-east-1' });

      const input = {
        Key: "sitemap.xml",
        Body: buffer.toString(),
        Bucket: "wisaw.com",
        // ACL: "public-read",
        // CloudFront decides the real TTL (the /sitemap.xml behaviour caches for minutes), but
        // the object must not claim a year either.
        CacheControl: "max-age=300",  
        ContentType: "application/xml",
      };

      const command = new PutObjectCommand(input);
      const response = await client.send(command);

    console.log('finished uploading')
  } catch (err) {
    console.error("Unable to upload sitemap.xml", { err })
  }

  // SEO sidecars for the edge injector: Lambda@Edge cannot reach Postgres, so the caption,
  // labels and place that make a page rankable are published as a small JSON object next to
  // the media. A failure here costs ranking quality, never the sitemap itself.
  try {
    // {"backfill": true} publishes a sidecar for every photo in the feed rather than only
    // recently touched ones. The feed is ordered newest-first, so an invocation that runs out
    // of time leaves the oldest photos behind and the set converges from the valuable end;
    // PUTs are idempotent, so re-invoking is always safe.
    const backfill = event?.backfill === true
    await publishSidecars(new S3Client({ region: 'us-east-1' }), imgBucketName, photos ?? [], backfill)
  } catch (err) {
    console.error("Unable to publish SEO sidecars", { err })
  }

  // console.log('done')

  traceLog('generateSiteMap:END', { duration: `${Date.now() - _traceStart}ms` })
  return true
}
