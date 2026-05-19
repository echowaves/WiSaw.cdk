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
  isNewWave: boolean
}

interface PhotoRow {
  id: string
  lat: number | null
  lon: number | null
  createdAt: string
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

interface GeoResult {
  locality: string | null
  district: string | null
  region: string | null
  country: string | null
  countryCode: string | null
}

const DEFAULT_GROUPING_LEVEL = 'CITY'

/**
 * Check if a photo fits into a wave based on the wave's groupingLevel
 * and anchor fields.
 */
function fitsPhotoInWave (
  photo: PhotoRow,
  wave: any,
  groupingLevel: string
): boolean {
  if (wave == null) return false

  const anchorLocality = wave.anchorLocality ?? null
  const anchorDistrict = wave.anchorDistrict ?? null
  const anchorRegion = wave.anchorRegion ?? null
  const anchorCountry = wave.anchorCountry ?? null

  const photoLocality = photo.locality ?? null
  const photoDistrict = photo.district ?? null
  const photoRegion = photo.region ?? null
  const photoCountry = photo.country ?? null

  switch (groupingLevel) {
    case 'DISTRICT':
      return photoDistrict === anchorDistrict &&
             photoLocality === anchorLocality &&
             photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'CITY':
      return photoLocality === anchorLocality &&
             photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'REGION':
      return photoRegion === anchorRegion &&
             photoCountry === anchorCountry
    case 'COUNTRY':
      return photoCountry === anchorCountry
    default:
      return false
    }
}

/**
 * Compute the wave name from the anchor's reverse geocode result and grouping level.
 */
function computeWaveNameFromKey (geo: GeoResult | null, groupingLevel: string): string | null {
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
  photoId: string,
  lon: number | null,
  lat: number | null,
  radius: number,
  splashDate: string,
  freezeDate: string,
  groupingLevel: string,
  anchorGeo: GeoResult
): Promise<string> {
  const waveUuid = uuidv4()
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  if (lon != null && lat != null) {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
        "location", "radius", "groupingLevel",
        "anchorLocality", "anchorDistrict", "anchorRegion", "anchorCountry",
        "isActive", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4,
        ST_MakePoint($5, $6), $7, $8,
            $9, $10, $11, $12,
            $13, false, $14, $15, $16, $17
          )
        `, [waveUuid, waveName, '', uuid, lon, lat, radius ?? 50, groupingLevel,
           anchorGeo.locality ?? null, anchorGeo.district ?? null,
           anchorGeo.region ?? null, anchorGeo.country ?? null,
           true, splashDate, freezeDate, now, now])
   } else {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
        "location", "radius", "groupingLevel",
        "anchorLocality", "anchorDistrict", "anchorRegion", "anchorCountry",
        "isActive", "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4,
        NULL, $5, $6,
            $7, $8, $9, $10,
            $11, false, $12, $13, $14, $15
          )
        `, [waveUuid, waveName, '', uuid, radius ?? 50, groupingLevel,
           anchorGeo.locality ?? null, anchorGeo.district ?? null,
           anchorGeo.region ?? null, anchorGeo.country ?? null,
           true, splashDate, freezeDate, now, now])
   }

  await psql.query(`
    INSERT INTO "WaveUsers" (
         "waveUuid", "uuid", "role", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5)
     `, [waveUuid, uuid, 'owner', now, now])

  await psql.query(`
    INSERT INTO "WavePhotos" (
         "waveUuid", "photoId", "createdBy", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ("waveUuid", "photoId") DO NOTHING
       `, [waveUuid, photoId, uuid, now, now])

  await _updatePhotosCount(waveUuid)

  return waveUuid
}

export default async function main (uuid: string, groupingLevel: string): Promise<AutoGroupResult> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()
  await _assertHasSecret(uuid)

  const gl = groupingLevel ?? DEFAULT_GROUPING_LEVEL

   // 1. Get user's ACTIVE wave (if any)
  const activeWaveResult = await psql.query(`
    SELECT * FROM "Waves"
    WHERE "createdBy" = $1 AND "isActive" = true
    ORDER BY "createdAt" DESC LIMIT 1
    `, [uuid])

   // 2. Get ALL ungrouped photos (ORDER BY createdAt ASC, no LIMIT)
  const photosResult = await psql.query(`
    SELECT
         "Photos".id,
      ST_Y("Photos".location::geometry) AS lat,
      ST_X("Photos".location::geometry) AS lon,
         "Photos"."createdAt",
         "Photos"."locality",
         "Photos"."district",
         "Photos"."region",
         "Photos"."country",
         "Photos"."countryCode"
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
    ORDER BY "Photos"."createdAt" ASC
        `, [uuid])

  const photos: PhotoRow[] = photosResult.rows.map((row: any) => ({
    id: row.id,
    lat: row.lat != null ? parseFloat(row.lat) : null,
    lon: row.lon != null ? parseFloat(row.lon) : null,
    createdAt: row.createdAt,
    locality: row.locality ?? null,
    district: row.district ?? null,
    region: row.region ?? null,
    country: row.country ?? null,
    countryCode: row.countryCode ?? null
      }))

   // Nothing to process
  if (photos.length === 0) {
    await psql.clean()
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, hasMore: false, isNewWave: false }
     }

   // 3. Process photos chronologically
  const activeWave = activeWaveResult.rows.length > 0 ? activeWaveResult.rows[0] : null
  let currentWaveUuid: string | null = null
  let currentWaveName: string | null = null
  let isNewWave: boolean = false
  let photosGrouped = 0
  let waveEarliest: moment.Moment | null = null
  let waveLatest: moment.Moment | null = null

  for (const photo of photos) {
     const waveGroupingLevel = activeWave != null ? activeWave.groupingLevel : null
     const levelChanged = activeWave != null && waveGroupingLevel !== gl
     const photoGeo: GeoResult = {
       locality: photo.locality,
       district: photo.district,
       region: photo.region,
       country: photo.country,
       countryCode: photo.countryCode
       }

     const fits = activeWave != null && !levelChanged && fitsPhotoInWave(photo, activeWave, gl)

     if (activeWave == null || levelChanged || !fits) {
         // Create new wave
       const earliest = waveEarliest ?? moment(photo.createdAt)
       const latest = waveLatest ?? moment(photo.createdAt)
       const dateRange = formatDateRange(earliest, latest)

       const waveNameFromGeo = computeWaveNameFromKey(photoGeo, gl)
       const waveName = waveNameFromGeo != null
          ? `${waveNameFromGeo}, ${dateRange}`
          : `${formatCoordinates(photo.lat ?? 0, photo.lon ?? 0)}, ${dateRange}`

       currentWaveUuid = await createWaveAndAssign(
         waveName,
         uuid,
         photo.id,
         photo.lon,
         photo.lat,
          50,
         earliest.format('YYYY-MM-DD HH:mm:ss.SSS'),
         latest.format('YYYY-MM-DD HH:mm:ss.SSS'),
         gl,
         photoGeo
        )

       isNewWave = true
       photosGrouped++
       waveEarliest = moment(photo.createdAt)
       waveLatest = moment(photo.createdAt)

         // Deactivate old active wave
       if (activeWave != null) {
         await psql.query(`
           UPDATE "Waves" SET "isActive" = false WHERE "waveUuid" = $1
           `, [activeWave.waveUuid])
        }
      } else {
         // Add photo to active wave
       const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
       await psql.query(`
         INSERT INTO "WavePhotos" ("waveUuid", "photoId", "createdBy", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("waveUuid", "photoId") DO NOTHING
        `, [activeWave.waveUuid, photo.id, uuid, now, now])

         // Update wave date range
       if (waveEarliest == null || moment(photo.createdAt).isBefore(waveEarliest)) {
         waveEarliest = moment(photo.createdAt)
        }
       if (waveLatest == null || moment(photo.createdAt).isAfter(waveLatest)) {
         waveLatest = moment(photo.createdAt)
        }

         // Update wave name if needed
       if (currentWaveUuid == null) {
         const waveNameFromGeo = computeWaveNameFromKey(photoGeo, gl)
         const waveName = waveNameFromGeo != null
            ? `${waveNameFromGeo}, ${formatDateRange(waveEarliest, waveLatest)}`
            : `${formatCoordinates(photo.lat ?? 0, photo.lon ?? 0)}, ${formatDateRange(waveEarliest, waveLatest)}`
         currentWaveName = waveName
         currentWaveUuid = activeWave.waveUuid
        }

       photosGrouped++
      }
    }

   // Update the current wave's date range
  if (currentWaveUuid != null && waveEarliest != null && waveLatest != null) {
    await psql.query(`
      UPDATE "Waves" SET
         "splashDate" = $1,
         "freezeDate" = $2,
         "updatedAt" = $3
      WHERE "waveUuid" = $4
     `, [waveEarliest.format('YYYY-MM-DD HH:mm:ss.SSS'),
        waveLatest.format('YYYY-MM-DD HH:mm:ss.SSS'),
        moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
        currentWaveUuid])

    await _updatePhotosCount(currentWaveUuid)
   }

  await psql.clean()
  return {
    waveUuid: currentWaveUuid,
    name: currentWaveName,
    photosGrouped,
    photosRemaining: 0,
    hasMore: false,
    isNewWave
    }
}
