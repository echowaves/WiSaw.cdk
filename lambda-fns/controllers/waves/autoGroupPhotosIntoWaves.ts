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
}

interface ReverseGeocodeResult {
  locality: string | null
  localityLevel: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

const MAX_PHOTOS_PER_WAVE = 1000

const geoClient = new GeoPlacesClient({})

const GRANULARITY_FALLBACKS: Record<string, number> = {
  DISTRICT: 10,
  CITY: 50,
  REGION: 250,
  COUNTRY: 1000
}

const DEFAULT_GRANULARITY = 'CITY'

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
        locality: addr.Locality ?? addr.District ?? null,
        localityLevel: (addr.Locality != null) ? 'locality' : ((addr.District != null) ? 'district' : null),
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

function getLocalityKey (granularity: string, geo: ReverseGeocodeResult): string | null {
  switch (granularity) {
    case 'DISTRICT': return geo.localityLevel === 'district' ? geo.locality : null
    case 'CITY': return geo.localityLevel === 'locality' ? geo.locality : geo.localityLevel === 'district' ? geo.locality : null
    case 'REGION': return geo.region
    case 'COUNTRY': return geo.country
    default: return geo.locality
    }
  }

function getLocalityName (granularity: string, geo: ReverseGeocodeResult): string | null {
  const key = getLocalityKey(granularity, geo)
  if (key != null) return key
     // fallback: use next lower level
  switch (granularity) {
    case 'REGION': return geo.locality ?? geo.country
    case 'COUNTRY': return geo.locality ?? geo.region
    default: return key
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

function haversineDistance (lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number): number => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function computeClusterRadius (anchorLat: number, anchorLon: number, photos: Photo[]): number {
  let maxDist = 0
  for (const p of photos) {
    if (p.lat != null && p.lon != null) {
      const d = haversineDistance(anchorLat, anchorLon, p.lat, p.lon)
      if (d > maxDist) maxDist = d
    }
  }
  return Math.round(Math.max(maxDist * 1.2, maxDist + 10, 5))
}

async function createWaveAndAssign (
  waveName: string, uuid: string, photoIds: string[],
  lon: number | null, lat: number | null, radius: number,
  splashDate: string, freezeDate: string, granularity: string
): Promise<string> {
  const waveUuid = uuidv4()
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  if (lon != null && lat != null) {
    await psql.query(`
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy",
        "location", "radius", "granularity", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        ST_MakePoint($5, $6), $7, $8, $9, $10, $11, $12, $13
      )
    `, [waveUuid, waveName, '', uuid, lon, lat, radius, granularity, false, splashDate, freezeDate, now, now])
  } else {
    await psql.query(`
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy",
        "location", "radius", "granularity", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        NULL, $5, $6, $7, $8, $9, $10, $11
      )
    `, [waveUuid, waveName, '', uuid, radius, granularity, false, splashDate, freezeDate, now, now])
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

export default async function main (uuid: string, granularity?: string): Promise<AutoGroupResult> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()
  await _assertHasSecret(uuid)

  // Query up to 1000 oldest ungrouped photos (with and without location)
  const photosResult = await psql.query(`
    SELECT
      "Photos".id,
      ST_Y("Photos".location::geometry) AS lat,
      ST_X("Photos".location::geometry) AS lon,
      "Photos"."createdAt"
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
    createdAt: row.createdAt
  }))

  // Nothing to process
  if (photos.length === 0) {
    await psql.clean()
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, hasMore: false }
  }

  // Find anchor = first photo with a location
  const anchor = photos.find(p => p.lat != null && p.lon != null)

  // All locationless — create single "Uncategorized" wave
  if (anchor == null || anchor.lat == null || anchor.lon == null) {
    const photoIds = photos.map(p => p.id)
    const earliest = moment(photos[0].createdAt)
    const latest = moment(photos[photos.length - 1].createdAt)
    const dateRange = formatDateRange(earliest, latest)
    const waveName = dateRange

    const waveUuid = await createWaveAndAssign(waveName, uuid, photoIds, null, null, 100,
      earliest.format('YYYY-MM-DD HH:mm:ss.SSS'), latest.format('YYYY-MM-DD HH:mm:ss.SSS'), '')

    const remainResult = await psql.query(`
      SELECT COUNT(*)::int AS count
      FROM "Photos"
      LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
      WHERE "Photos".uuid = $1
        AND "Photos".active = true
        AND "WavePhotos"."photoId" IS NULL
    `, [uuid])
    const photosRemaining = remainResult.rows[0].count

    await psql.clean()
    return {
      waveUuid,
      name: waveName,
      photosGrouped: photoIds.length,
      photosRemaining,
      hasMore: photosRemaining > 0
    }
  }

  const anchorLat = anchor.lat
  const anchorLon = anchor.lon
  const gran = granularity ?? DEFAULT_GRANULARITY
  const threshold = GRANULARITY_FALLBACKS[gran] ?? GRANULARITY_FALLBACKS[DEFAULT_GRANULARITY]
  // Per-invocation locality cache to avoid redundant geocode calls
  const localityCache = new Map<string, ReverseGeocodeResult>()
    // Walk forward, collecting photos within threshold km of anchor or locationless; skip outliers
  const collected: Photo[] = []
  for (const photo of photos) {
    if (photo.lat == null || photo.lon == null) {
       // Locationless — include
      collected.push(photo)
     } else {
      const distance = haversineDistance(anchorLat, anchorLon, photo.lat, photo.lon)
      if (distance <= threshold) {
        collected.push(photo)
       }
       // Out-of-range photos are skipped, left ungrouped for future processing
     }
   }

    // Geocode the anchor with cache lookup
  const cacheKey = `${anchorLat},${anchorLon}`
  let geo = localityCache.get(cacheKey)
  if (geo == null) {
    geo = await reverseGeocode(anchorLat, anchorLon)
    if (geo != null) {
      localityCache.set(cacheKey, geo)
    }
  }
  const localityName = geo != null ? getLocalityName(gran, geo) : null

  const earliest = moment(collected[0].createdAt)
  const latest = moment(collected[collected.length - 1].createdAt)
  const dateRange = formatDateRange(earliest, latest)
  const waveName = localityName != null
     ? `${localityName}, ${dateRange}`
     : `${formatCoordinates(anchorLat, anchorLon)}, ${dateRange}`

  const photoIds = collected.map(p => p.id)
  const waveRadius = computeClusterRadius(anchorLat, anchorLon, collected)
  const waveUuid = await createWaveAndAssign(
    waveName, uuid, photoIds,
    anchorLon, anchorLat, waveRadius,
    earliest.format('YYYY-MM-DD HH:mm:ss.SSS'), latest.format('YYYY-MM-DD HH:mm:ss.SSS'),
    gran
  )

  const remainResult = await psql.query(`
    SELECT COUNT(*)::int AS count
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
  `, [uuid])
  const photosRemaining = remainResult.rows[0].count

  await psql.clean()
  return {
    waveUuid,
    name: waveName,
    photosGrouped: collected.length,
    photosRemaining,
    hasMore: photosRemaining > 0
  }
}
