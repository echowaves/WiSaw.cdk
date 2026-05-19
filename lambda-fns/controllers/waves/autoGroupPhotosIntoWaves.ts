import { GeoPlacesClient, ReverseGeocodeCommand } from '@aws-sdk/client-geo-places'
import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { _updatePhotosCount } from './_updatePhotosCount'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertHasSecret } from './_assertHasSecret'

interface AutoGroupResult {
  waveUuid: string | null
  name: string | null
  photosGrouped: number
  photosRemaining: number
  hasMore: boolean
}

interface Photo {
  id: string
  lat: number | null
  lon: number | null
  createdAt: string
  locality: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

interface ReverseGeocodeResult {
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

const MAX_PHOTOS_PER_WAVE = 1000
const DEFAULT_GROUPING_LEVEL = 'CITY'

const geoClient = new GeoPlacesClient({})

async function reverseGeocode (lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  try {
    const command = new ReverseGeocodeCommand({
      QueryPosition: [lon, lat],
      Language: 'en',
      MaxResults: 1
     })
    const response = await geoClient.send(command)
    const item = response.ResultItems?.[0]
    if (item?.Address != null) {
      const addr = item.Address
      return {
        locality: addr.Locality ?? null,
        district: addr.District ?? null,
        region: addr.Region?.Name ?? null,
        country: addr.Country?.Name ?? null,
        countryCode: addr.Country?.Code2 ?? null
       }
     }
    return null
   } catch {
    return null
   }
}

/**
 * Compute a grouping key for a photo based on its reverse geocode result and grouping level.
 * Photos with the same grouping key can be grouped together.
 *
 * Grouping rules:
 * - DISTRICT: District + Locality + Region + Country must all match
 * - CITY: Locality + Region + Country must match
 * - REGION: Region + Country must match
 * - COUNTRY: Country must match
 *
 * Null values are converted to the string "null" so photos with missing fields
 * can still be grouped together.
 */
function computeGroupingKey (geo: ReverseGeocodeResult | null, groupingLevel: string): string | null {
  if (geo == null) { return null }

  const d = geo.district ?? 'null'
  const l = geo.locality ?? 'null'
  const r = geo.region ?? 'null'
  const c = geo.country ?? 'null'

  switch (groupingLevel) {
    case 'DISTRICT':
       return `district|${d}|${l}|${r}|${c}`
    case 'CITY':
       return `city|${l}|${r}|${c}`
    case 'REGION':
       return `region|${r}|${c}`
    case 'COUNTRY':
       return `country|${c}`
    default:
       return `city|${l}|${r}|${c}`
   }
}

/**
 * Compute the wave name from the anchor's reverse geocode result and grouping level.
 * Uses the appropriate locality field based on grouping level.
 */
function computeWaveNameFromKey (geo: ReverseGeocodeResult | null, groupingLevel: string): string | null {
  if (geo == null) { return null }

  switch (groupingLevel) {
    case 'DISTRICT':
       // For DISTRICT, use District if available, else Locality
       return geo.district ?? geo.locality ?? geo.region ?? geo.country ?? null
    case 'CITY':
       // For CITY, use Locality
       return geo.locality ?? geo.region ?? geo.country ?? null
    case 'REGION':
       // For REGION, use Region
       return geo.region ?? geo.country ?? null
    case 'COUNTRY':
       // For COUNTRY, use Country
       return geo.country ?? null
    default:
       return geo.locality ?? geo.region ?? geo.country ?? null
   }
}

function formatCoordinates (lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`
}

function formatDateRange (earliest: moment.Moment, latest: moment.Moment): string {
  const sameDay = earliest.isSame(latest, 'day')
  const sameMonth = earliest.isSame(latest, 'month')
  const sameYear = earliest.isSame(latest, 'year')

  if (sameDay) {
    return earliest.format('MMM D, YYYY')
   }
  if (sameMonth) {
    return earliest.format('MMM YYYY')
   }
  if (sameYear) {
    return `${earliest.format('MMM')} – ${latest.format('MMM YYYY')}`
   }
  return `${earliest.format('MMM YYYY')} – ${latest.format('MMM YYYY')}`
}

async function createWaveAndAssign (
  waveName: string,
  uuid: string,
  photoIds: string[],
  lon: number | null,
  lat: number | null,
  radius: number,
  splashDate: string,
  freezeDate: string,
  groupingLevel: string
): Promise<string> {
  const waveUuid = uuidv4()
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  if (lon != null && lat != null) {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
           "location", "radius", "groupingLevel", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4,
        ST_MakePoint($5, $6), $7, $8, $9, $10, $11, $12, $13
         )
       `, [waveUuid, waveName, '', uuid, lon, lat, radius ?? 50, groupingLevel, false, splashDate, freezeDate, now, now])
   } else {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
           "location", "radius", "groupingLevel", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, $3, $4,
        NULL, $5, $6, $7, $8, $9, $10, $11
         )
       `, [waveUuid, waveName, '', uuid, radius ?? 50, groupingLevel, false, splashDate, freezeDate, now, now])
   }

  await psql.query(`
    INSERT INTO "WaveUsers" (
         "waveUuid", "uuid", "role", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5)
     `, [waveUuid, uuid, 'owner', now, now])

  for (const photoId of photoIds) {
    await psql.query(`
      INSERT INTO "WavePhotos" (
           "waveUuid", "photoId", "createdBy", "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("waveUuid", "photoId") DO NOTHING
       `, [waveUuid, photoId, uuid, now, now])
   }

  await _updatePhotosCount(waveUuid)

  return waveUuid
}

export default async function main (uuid: string, groupingLevel?: string): Promise<AutoGroupResult> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()
  await _assertHasSecret(uuid)

  const gl = groupingLevel ?? DEFAULT_GROUPING_LEVEL

   // Query up to 1000 oldest ungrouped photos (with and without location)
  const photosResult = await psql.query(`
    SELECT
         "Photos".id,
      ST_Y("Photos".location::geometry) AS lat,
      ST_X("Photos".location::geometry) AS lon,
         "Photos"."createdAt",
         "Photos"."locality",
         "Photos"."region",
         "Photos"."country",
         "Photos"."countryCode"
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
    ORDER BY "Photos"."createdAt" ASC
    LIMIT $2
     `, [uuid, MAX_PHOTOS_PER_WAVE])

  const photos: Photo[] = photosResult.rows.map((row: any) => ({
    id: row.id,
    lat: row.lat != null ? parseFloat(row.lat) : null,
    lon: row.lon != null ? parseFloat(row.lon) : null,
    createdAt: row.createdAt,
    locality: row.locality ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    countryCode: row.countryCode ?? null
   }))

   // Nothing to process
  if (photos.length === 0) {
    await psql.clean()
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, hasMore: false }
   }

   // Per-invocation locality cache to avoid redundant geocode calls
  const localityCache = new Map<string, ReverseGeocodeResult>()

   // Separate photos into groups by field-matching key
   // Group 1: Photos with valid grouping keys (grouped by matching fields)
   // Group 2: Photos without location fields (will get their own wave per photo)
  const groups = new Map<string, Photo[]>()
  const locationlessPhotos: Photo[] = []

  for (const photo of photos) {
    if (photo.locality == null && photo.region == null && photo.country == null) {
       // Photo without location fields - collect for separate handling
      locationlessPhotos.push(photo)
      continue
     }

     // Get reverse geocode result (from DB or cache)
    const latStr = photo.lat?.toString() ?? ''
    const lonStr = photo.lon?.toString() ?? ''
    const cacheKey = `${latStr},${lonStr}`
    let geo: ReverseGeocodeResult | null = localityCache.get(cacheKey) ?? null

    if (geo == null) {
       // Try to construct from DB fields first
      if (photo.locality != null || photo.region != null || photo.country != null) {
         // We don't have district from DB, so construct without it
        geo = {
          locality: photo.locality,
          district: null, // Not available from DB
          region: photo.region,
          country: photo.country,
          countryCode: photo.countryCode
         }
       } else if (photo.lat != null && photo.lon != null) {
         // Geocode if we have coordinates but no locality data
        geo = await reverseGeocode(photo.lat, photo.lon)
       }

      if (geo != null) {
        localityCache.set(cacheKey, geo)
       }
     }

     // Compute grouping key
    const key = computeGroupingKey(geo, gl)

    if (key == null) {
       // Photo can't be grouped - add to locationless for separate handling
      locationlessPhotos.push(photo)
     } else {
       // Add to group
      const group = groups.get(key)
      if (group != null) {
        group.push(photo)
       } else {
        groups.set(key, [photo])
       }
     }
   }

   // Process the largest group first
  let bestGroup = locationlessPhotos

  for (const [, group] of groups) {
    if (group.length > bestGroup.length) {
      bestGroup = group
     }
   }

   // If no groups at all, return "nothing to group"
  if (bestGroup.length === 0) {
    await psql.clean()
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: photos.length, hasMore: photos.length > 0 }
   }

   // Compute wave name from the first photo in the best group
  const anchor = bestGroup[0]
  const latStr = anchor.lat?.toString() ?? ''
  const lonStr = anchor.lon?.toString() ?? ''
  const anchorCacheKey = `${latStr},${lonStr}`
  let anchorGeo: ReverseGeocodeResult | null = localityCache.get(anchorCacheKey) ?? null

  if (anchorGeo == null) {
    if (anchor.locality != null || anchor.region != null || anchor.country != null) {
      anchorGeo = {
        locality: anchor.locality,
        district: null, // Not available from DB
        region: anchor.region,
        country: anchor.country,
        countryCode: anchor.countryCode
       }
     } else if (anchor.lat != null && anchor.lon != null) {
      anchorGeo = await reverseGeocode(anchor.lat, anchor.lon)
     }
    if (anchorGeo != null) {
      localityCache.set(anchorCacheKey, anchorGeo)
     }
   }

  const waveNameFromGeo = computeWaveNameFromKey(anchorGeo, gl)
  const earliest = moment(bestGroup[0].createdAt)
  const latest = moment(bestGroup[bestGroup.length - 1].createdAt)
  const dateRange = formatDateRange(earliest, latest)
  const waveName = waveNameFromGeo != null
       ? `${waveNameFromGeo}, ${dateRange}`
       : `${formatCoordinates(anchor.lat ?? 0, anchor.lon ?? 0)}, ${dateRange}`

  const photoIds = bestGroup.map(p => p.id)
  const waveUuid = await createWaveAndAssign(
    waveName,
    uuid,
    photoIds,
    anchor.lon,
    anchor.lat,
     50, // default radius 50
    earliest.format('YYYY-MM-DD HH:mm:ss.SSS'),
    latest.format('YYYY-MM-DD HH:mm:ss.SSS'),
    gl
   )

   // Calculate remaining photos
  const photosGrouped = bestGroup.length
  const photosRemaining = photos.length - photosGrouped

  await psql.clean()
  return {
    waveUuid,
    name: waveName,
    photosGrouped,
    photosRemaining,
    hasMore: photosRemaining > 0
    }
}
