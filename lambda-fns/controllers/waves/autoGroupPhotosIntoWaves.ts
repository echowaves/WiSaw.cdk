import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { _updatePhotosCount } from './_updatePhotosCount'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertHasSecret } from './_assertHasSecret'
import { fitsPhotoInWave } from './_autoGroupGeo'

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
const BATCH_LIMIT = 200

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

/**
 * Return the key with the highest count in a frequency map.
 */
function getMostFrequentLocality (localityCounts: Record<string, number>): string | null {
  let bestKey: string | null = null
  let bestCount = 0
  for (const [key, count] of Object.entries(localityCounts)) {
    if (count > bestCount) {
      bestCount = count
      bestKey = key
    }
  }
  return bestKey
}

/**
 * Build a GeoResult from the most-frequent locality and its parallel maps.
 */
function buildGeoFromMostFrequent (
  mostFreqLocality: string | null,
  districtCounts: Record<string, number>,
  regionCounts: Record<string, number>,
  countryCounts: Record<string, number>,
  districtMap: Record<string, string | null>,
  regionMap: Record<string, string | null>,
  countryMap: Record<string, string | null>
): GeoResult {
  if (mostFreqLocality == null) return { locality: null, district: null, region: null, country: null, countryCode: null }

  // Find most frequent district for the dominant locality
  let bestDistrict: string | null = null
  let bestDistrictCount = 0
  const entries = Object.entries(districtCounts).filter(([k]) => k.startsWith(mostFreqLocality + '|'))
  for (const [key, count] of entries) {
    if (count > bestDistrictCount) {
      bestDistrictCount = count
      // Extract district part after the '|' separator
      const parts = key.split('|')
      bestDistrict = parts.length > 1 ? parts[1] : null
    }
  }

  return {
    locality: mostFreqLocality,
    district: bestDistrict ?? districtMap[mostFreqLocality] ?? null,
    region: regionMap[mostFreqLocality] ?? null,
    country: countryMap[mostFreqLocality] ?? null,
    countryCode: null
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

/**
 * Bulk-insert photo IDs into WavePhotos and update the photos count.
 */
async function flushWavePhotos (waveUuid: string, photoIds: string[], uuid: string): Promise<void> {
  if (photoIds.length === 0) return
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const values: any[] = []
  const placeholders: string[] = []
  let idx = 1
  for (const photoId of photoIds) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`)
    values.push(waveUuid, photoId, uuid, now, now)
    idx += 5
  }
  await psql.query(`
    INSERT INTO "WavePhotos" ("waveUuid", "photoId", "createdBy", "createdAt", "updatedAt")
    VALUES ${placeholders.join(', ')}
    ON CONFLICT ("waveUuid", "photoId") DO NOTHING
  `, values)
  await _updatePhotosCount(waveUuid)
}

async function createWave (
  waveName: string,
  uuid: string,
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

  return waveUuid
}

export default async function main (uuid: string, groupingLevel: string): Promise<AutoGroupResult> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()
  await _assertHasSecret(uuid)

  const gl = groupingLevel ?? DEFAULT_GROUPING_LEVEL

  // 1. Get user's ACTIVE wave (if any)
  const activeWaveResult = await psql.query(`
    SELECT *,
      ST_Y("location"::geometry) AS "anchorLat",
      ST_X("location"::geometry) AS "anchorLon"
    FROM "Waves"
    WHERE "createdBy" = $1 AND "isActive" = true
    ORDER BY "createdAt" DESC LIMIT 1
    `, [uuid])

  // 2. Get ungrouped photos with LIMIT
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
    LIMIT $2
        `, [uuid, BATCH_LIMIT])

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
  let activeWave = activeWaveResult.rows.length > 0 ? activeWaveResult.rows[0] : null
  let currentWaveUuid: string | null = null
  let currentWaveName: string | null = null
  let refinementDone: boolean = false
  let isNewWave: boolean = false
  let photosGrouped = 0
  let waveEarliest: moment.Moment | null = null
  let waveLatest: moment.Moment | null = null

  // Frequency maps for most-frequent locality tracking
  let localityCounts: Record<string, number> = {}
  let districtCounts: Record<string, number> = {}
  let regionCounts: Record<string, number> = {}
  let countryCounts: Record<string, number> = {}
  let districtMap: Record<string, string | null> = {}
  let regionMap: Record<string, string | null> = {}
  let countryMap: Record<string, string | null> = {}

  // Batch accumulator for bulk INSERT
  let pendingPhotoIds: string[] = []
  let pendingWaveUuid: string | null = activeWave?.waveUuid ?? null

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
      // Flush pending photos for the previous wave
      if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
        await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
        pendingPhotoIds = []
      }

      // Create new wave
      const earliest = waveEarliest ?? moment(photo.createdAt)
      const latest = waveLatest ?? moment(photo.createdAt)
      const dateRange = formatDateRange(earliest, latest)

      const waveNameFromGeo = computeWaveNameFromKey(photoGeo, gl)
      const waveName = waveNameFromGeo != null
        ? `${waveNameFromGeo}, ${dateRange}`
        : `${formatCoordinates(photo.lat ?? 0, photo.lon ?? 0)}, ${dateRange}`

      currentWaveUuid = await createWave(
        waveName,
        uuid,
        photo.lon,
        photo.lat,
        50,
        earliest.format('YYYY-MM-DD HH:mm:ss.SSS'),
        latest.format('YYYY-MM-DD HH:mm:ss.SSS'),
        gl,
        photoGeo
      )

      // Start accumulating photos for the new wave
      pendingWaveUuid = currentWaveUuid
      pendingPhotoIds = [photo.id]

      isNewWave = true
      refinementDone = false
      photosGrouped++
      waveEarliest = moment(photo.createdAt)
      waveLatest = moment(photo.createdAt)

      // Reset frequency maps for the new wave
      localityCounts = {}
      districtCounts = {}
      regionCounts = {}
      countryCounts = {}
      districtMap = {}
      regionMap = {}
      countryMap = {}

      // Deactivate old active wave
      if (activeWave != null) {
        await psql.query(`
          UPDATE "Waves" SET "isActive" = false WHERE "waveUuid" = $1
          `, [activeWave.waveUuid])
      }

      // Update activeWave to the newly created wave for subsequent photos
      activeWave = {
        ...activeWave,
        waveUuid: currentWaveUuid,
        anchorLocality: photoGeo.locality ?? null,
        anchorDistrict: photoGeo.district ?? null,
        anchorRegion: photoGeo.region ?? null,
        anchorCountry: photoGeo.country ?? null,
        anchorLat: photo.lat,
        anchorLon: photo.lon,
        groupingLevel: gl,
        isActive: true
      }
    } else {
      // Accumulate photo for bulk insert
      pendingPhotoIds.push(photo.id)

      // Task 1: Track locality frequency for wave naming refinement
      const loc = photo.locality ?? 'unknown'
      localityCounts[loc] = (localityCounts[loc] ?? 0) + 1
      districtMap[loc] = photo.district
      regionMap[loc] = photo.region
      countryMap[loc] = photo.country

      // Track combined locality|district frequency for anchor refinement
      const dKey = `${loc}|${photo.district ?? 'unknown'}`
      districtCounts[dKey] = (districtCounts[dKey] ?? 0) + 1
      regionCounts[loc] = (regionCounts[loc] ?? 0) + 1
      countryCounts[loc] = (countryCounts[loc] ?? 0) + 1

      // Update wave date range
      if (waveEarliest == null || moment(photo.createdAt).isBefore(waveEarliest)) {
        waveEarliest = moment(photo.createdAt)
      }
      if (waveLatest == null || moment(photo.createdAt).isAfter(waveLatest)) {
        waveLatest = moment(photo.createdAt)
      }

      // Task 2-4: Refine wave name and anchor fields when dominant locality changes
      if (!refinementDone) {
        const mostFreqLocality = getMostFrequentLocality(localityCounts)
        const refinedGeo = buildGeoFromMostFrequent(
          mostFreqLocality,
          districtCounts, regionCounts, countryCounts,
          districtMap, regionMap, countryMap
        )
        const waveNameFromGeo = computeWaveNameFromKey(refinedGeo, gl)
        const waveName = waveNameFromGeo != null
          ? `${waveNameFromGeo}, ${formatDateRange(waveEarliest, waveLatest)}`
          : `${formatCoordinates(photo.lat ?? 0, photo.lon ?? 0)}, ${formatDateRange(waveEarliest, waveLatest)}`
        currentWaveName = waveName

        // Update active wave anchor fields to reflect dominant locality (Task 3)
        activeWave = {
          ...activeWave,
          anchorLocality: refinedGeo.locality ?? null,
          anchorDistrict: refinedGeo.district ?? null,
          anchorRegion: refinedGeo.region ?? null,
          anchorCountry: refinedGeo.country ?? null
        }

        refinementDone = true
      }

      photosGrouped++
    }
  }

  // Flush remaining pending photos
  if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
    await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
  }

  // Update the current wave's date range and persisted name (Task 4)
  if (currentWaveUuid != null && waveEarliest != null && waveLatest != null) {
    // Compute final refined name using most-frequent locality
    const mostFreqLocality = getMostFrequentLocality(localityCounts)
    const refinedGeo = buildGeoFromMostFrequent(
      mostFreqLocality,
      districtCounts, regionCounts, countryCounts,
      districtMap, regionMap, countryMap
    )
    const finalWaveNameBase = computeWaveNameFromKey(refinedGeo, gl)
    const finalWaveName = finalWaveNameBase != null
      ? `${finalWaveNameBase}, ${formatDateRange(waveEarliest, waveLatest)}`
      : `${formatCoordinates(0, 0)}, ${formatDateRange(waveEarliest, waveLatest)}`

    currentWaveName = finalWaveName

    await psql.query(`
      UPDATE "Waves" SET
         "splashDate" = $1,
         "freezeDate" = $2,
         "name" = $3,
         "anchorLocality" = $4,
         "anchorDistrict" = $5,
         "anchorRegion" = $6,
         "anchorCountry" = $7,
         "updatedAt" = $8
      WHERE "waveUuid" = $9
     `, [waveEarliest.format('YYYY-MM-DD HH:mm:ss.SSS'),
      waveLatest.format('YYYY-MM-DD HH:mm:ss.SSS'),
      finalWaveName,
      refinedGeo.locality ?? null,
      refinedGeo.district ?? null,
      refinedGeo.region ?? null,
      refinedGeo.country ?? null,
      moment().format('YYYY-MM-DD HH:mm:ss.SSS'),
      currentWaveUuid])
  }

  // Count remaining ungrouped photos
  const remainingResult = await psql.query(`
    SELECT COUNT(*) AS cnt
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
  `, [uuid])
  const photosRemaining = parseInt(remainingResult.rows[0]?.cnt ?? '0', 10)

  await psql.clean()
  return {
    waveUuid: currentWaveUuid,
    name: currentWaveName,
    photosGrouped,
    photosRemaining,
    hasMore: photosRemaining > 0,
    isNewWave
  }
}
