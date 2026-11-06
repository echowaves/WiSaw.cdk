const { SitemapStream, streamToPromise } = require("sitemap")

import psql from "../../psql"
import { traceLog } from '../../utilities/trace'

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"; // ES Modules import

// Only photos touched since the last run get a fresh SEO sidecar; the initial population is
// scripts/publish-seo-sidecars.js. Without this window the job would issue ~21k PUTs every
// 5 hours for content that almost never changes.
const SIDECAR_LOOKBACK_HOURS = Number(process.env.SIDECAR_LOOKBACK_HOURS ?? 6)
const SIDECAR_CONCURRENCY = 20

type SeoSidecar = {
  v: number
  caption: string
  labels: string[]
  created: string
  location: string
  width: string
  height: string
}

function clean (value: any): string {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

// Newest-first label list from the Rekognition JSONB blob, de-duplicated case-insensitively.
function pickLabels (rows: any[], limit = 8): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows) {
    for (const label of Array.isArray(row?.labels) ? row.labels : []) {
      const name = clean(label)
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
      if (out.length >= limit) return out
    }
  }
  return out
}

function locationText (row: any): string {
  return [row?.locality, row?.district, row?.region]
    .map((part) => clean(part))
    .filter(Boolean)
    // "Brooklyn, New York" reads well; a repeated place name does not.
    .filter((part: string, i: number, all: string[]) => all.indexOf(part) === i)
    .join(', ')
}

async function putSidecars (client: S3Client, bucket: string, photos: any[]) {
  let written = 0
  let failed = 0

  for (let i = 0; i < photos.length; i += SIDECAR_CONCURRENCY) {
    const chunk = photos.slice(i, i + SIDECAR_CONCURRENCY)
    const results = await Promise.allSettled(chunk.map(async (photo: any) => {
      const sidecar: SeoSidecar = {
        v: 1,
        caption: clean(photo.lastComment).slice(0, 200),
        labels: pickLabels([photo]),
        created: photo.createdAt ? new Date(photo.createdAt).toISOString() : '',
        location: locationText(photo),
        width: clean(photo.width),
        height: clean(photo.height)
      }
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `seo/${photo.id}.json`,
        Body: JSON.stringify(sidecar),
        ContentType: 'application/json',
        // The edge injector caches this in memory; the object needs no caching of its own and
        // is overwritten on the next run if anything changes.
        CacheControl: 'max-age=60'
      }))
    }))
    results.forEach((r) => (r.status === 'fulfilled' ? written++ : failed++))
  }

  console.log(`sidecars written=${written} failed=${failed}`)
}

// eslint-disable-next-line import/prefer-default-export
export async function main(event: any = {}, context: any /*, cb: any*/) {
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

  photos?.forEach((photo: any) => {
    // const jsonObj = JSON.parse(JSON.stringify(photo))
    // lastmod is what tells Google a URL is worth re-crawling. A sitemap of 21k URLs with no
    // dates gets polled rarely, which kept deep pages out of the index long after the
    // canonical fix landed.
    const lastmod = photo?.updatedAt ? new Date(photo.updatedAt).toISOString() : undefined
    const labels = pickLabels([photo])
    const caption = clean(photo.lastComment)
    const summary = caption || labels.join(', ')
    const title = (summary || `WiSaw ${photo.video ? 'video' : 'photo'} ${photo.id}`).slice(0, 100)
    const createdAt = photo.createdAt ? new Date(photo.createdAt).toISOString() : undefined

    if(photo?.video === true) {
      smStream.write({ url: `/videos/${photo.id}`,
      lastmod,
      video: [
        {
          thumbnail_loc: `https://img.wisaw.com/${photo.id}-thumb.webp`,
          title,
          description: (summary || title).slice(0, 2048),
          content_loc: `https://img.wisaw.com/${photo.id}.mov`,
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
            url: `https://img.wisaw.com/${photo.id}.webp`,
            title,
            caption: (summary || title).slice(0, 512),
            geoLocation: locationText(photo) || undefined,
            license: 'https://wisaw.com/terms'
          }
        ]
      })
    }
  })

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
    const imgBucket = process.env.S3_IMAGES_BUCKET || 'wisaw-img-prod'
    const nowMs = Date.now()
    const lookbackMs = SIDECAR_LOOKBACK_HOURS * 60 * 60 * 1000
    const recent = (photos ?? []).filter((photo: any) => {
      const touchedAt = new Date(photo?.updatedAt ?? 0).getTime()
      return Number.isFinite(touchedAt) && nowMs - touchedAt <= lookbackMs
    })
    console.log('sidecar candidates:', recent.length, 'lookbackHours:', SIDECAR_LOOKBACK_HOURS)

    if (recent.length > 0) {
      await putSidecars(new S3Client({ region: 'us-east-1' }), imgBucket, recent)
    }
  } catch (err) {
    console.error("Unable to publish SEO sidecars", { err })
  }

  // console.log('done')

  traceLog('generateSiteMap:END', { duration: `${Date.now() - _traceStart}ms` })
  return true
}
