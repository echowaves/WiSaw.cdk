import { v4 as uuidv4 } from 'uuid'
import moment from 'moment'
import psql from '../../psql'
import { _updatePhotosCount } from './_updatePhotosCount'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _assertHasSecret } from './_assertHasSecret'
import { fitsPhotoInWave, DISTANCE_THRESHOLDS_KM } from './_autoGroupGeo'
import { _filterPhotosInRadius } from './_filterPhotosInRadius'
import { getSeasonKey } from './_seasonKey'
import { formatSeasonName } from './_seasonName'

interface AutoGroupResult {
  waveUuid: string | null
  name: string | null
  photosGrouped: number
  photosRemaining: number
  wavesCreated: number
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

const BATCH_LIMIT = 1000
const MAX_PHOTOS_PER_WAVE = 1000

/**
 * Compute the wave name from the anchor's reverse geocode result and grouping level.
 */
function computeWaveNameFromKey (geo: GeoResult | null, groupingLevel: string, seasonKey: string): string | null {
  if (geo == null) { return null }

  let localityPart: string | null
  switch (groupingLevel) {
    case 'DISTRICT':
      localityPart = geo.district ?? geo.locality ?? geo.region ?? geo.country ?? null
      break
    case 'CITY':
      localityPart = geo.locality ?? geo.region ?? geo.country ?? null
      break
    case 'REGION':
      localityPart = geo.region ?? geo.country ?? null
      break
    case 'COUNTRY':
      localityPart = geo.country ?? null
      break
    default:
      localityPart = geo.locality ?? geo.region ?? geo.country ?? null
  }

  if (localityPart == null) { return null }
  return `${localityPart}, ${formatSeasonName(seasonKey)}`
}

/**
 * Return the key with the highest count in a frequency map.
 */
function getMostFrequentLocality (localityCounts: Record<string, number>): string | null {
  let bestKey: string | null = null
  let bestCount = 0
  for (const [key, count] of Object.entries(localityCounts)) {
    if (key === 'unknown') continue
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

function coordinateFallbackName (lat: number | null, lon: number | null, seasonKey: string): string {
  if (lat != null && lon != null) {
    return `${formatCoordinates(lat, lon)}, ${formatSeasonName(seasonKey)}`
  }
  return `Unlocated, ${formatSeasonName(seasonKey)}`
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
  anchorGeo: GeoResult,
  photoCreatedAt: string
): Promise<string> {
  const waveUuid = uuidv4()

  if (lon != null && lat != null) {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
        "location", "radius", "groupingLevel",
        "anchorLocality", "anchorDistrict", "anchorRegion", "anchorCountry",
        "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4,
        ST_MakePoint($5, $6), $7, $8,
            $9, $10, $11, $12,
            false, $13, $14, $15, $16
          )
        `, [waveUuid, waveName, '', uuid, lon, lat, radius ?? 50, groupingLevel,
      anchorGeo.locality ?? null, anchorGeo.district ?? null,
      anchorGeo.region ?? null, anchorGeo.country ?? null,
      splashDate, photoCreatedAt, photoCreatedAt, photoCreatedAt])
  } else {
    await psql.query(`
      INSERT INTO "Waves" (
           "waveUuid", "name", "description", "createdBy",
        "location", "radius", "groupingLevel",
        "anchorLocality", "anchorDistrict", "anchorRegion", "anchorCountry",
        "open", "splashDate", "freezeDate", "createdAt", "updatedAt"
          ) VALUES (
            $1, $2, $3, $4,
        NULL, $5, $6,
            $7, $8, $9, $10,
            false, $11, $12, $13, $14
          )
        `, [waveUuid, waveName, '', uuid, radius ?? 50, groupingLevel,
      anchorGeo.locality ?? null, anchorGeo.district ?? null,
      anchorGeo.region ?? null, anchorGeo.country ?? null,
      splashDate, photoCreatedAt, photoCreatedAt, photoCreatedAt])
  }

  await psql.query(`
    INSERT INTO "WaveUsers" (
         "waveUuid", "uuid", "role", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5)
     `, [waveUuid, uuid, 'owner', photoCreatedAt, photoCreatedAt])

  return waveUuid
}

/**
 * Search for an existing wave matching the photo's locality, season, and groupingLevel.
 * Uses string matching on anchor fields (scoped by level) with ST_DWithin distance fallback.
 * Returns the most recently created matching wave, or null.
 */
async function findMatchingWave (
  uuid: string,
  groupingLevel: string,
  photo: PhotoRow,
  photoSeasonKey: string
): Promise<any | null> {
  // Build string-match clause based on groupingLevel
  const stringConditions: string[] = []
  const params: any[] = [uuid, groupingLevel]
  let paramIdx = 3

  // String match conditions — only apply if the photo has the relevant field
  let hasStringFields = false
  switch (groupingLevel) {
    case 'DISTRICT':
      if (photo.locality != null && photo.district != null && photo.region != null && photo.country != null) {
        stringConditions.push(`"anchorLocality" = $${paramIdx} AND "anchorDistrict" = $${paramIdx + 1} AND "anchorRegion" = $${paramIdx + 2} AND "anchorCountry" = $${paramIdx + 3}`)
        params.push(photo.locality, photo.district, photo.region, photo.country)
        paramIdx += 4
        hasStringFields = true
      }
      break
    case 'CITY':
      if (photo.locality != null && photo.region != null && photo.country != null) {
        stringConditions.push(`"anchorLocality" = $${paramIdx} AND "anchorRegion" = $${paramIdx + 1} AND "anchorCountry" = $${paramIdx + 2}`)
        params.push(photo.locality, photo.region, photo.country)
        paramIdx += 3
        hasStringFields = true
      }
      break
    case 'REGION':
      if (photo.region != null && photo.country != null) {
        stringConditions.push(`"anchorRegion" = $${paramIdx} AND "anchorCountry" = $${paramIdx + 1}`)
        params.push(photo.region, photo.country)
        paramIdx += 2
        hasStringFields = true
      }
      break
    case 'COUNTRY':
      if (photo.country != null) {
        stringConditions.push(`"anchorCountry" = $${paramIdx}`)
        params.push(photo.country)
        paramIdx += 1
        hasStringFields = true
      }
      break
  }

  // Distance fallback condition
  const threshold = DISTANCE_THRESHOLDS_KM[groupingLevel]
  let hasDistanceFields = false
  let distanceCondition = ''
  if (photo.lat != null && photo.lon != null && threshold != null) {
    distanceCondition = `ST_DWithin("location"::geography, ST_SetSRID(ST_MakePoint($${paramIdx}, $${paramIdx + 1}), 4326)::geography, $${paramIdx + 2})`
    params.push(photo.lon, photo.lat, threshold * 1000)
    paramIdx += 3
    hasDistanceFields = true
  }

  // Build the OR clause
  let matchClause: string
  if (hasStringFields && hasDistanceFields) {
    matchClause = `(${stringConditions[0]}) OR (${distanceCondition})`
  } else if (hasStringFields) {
    matchClause = stringConditions[0]
  } else if (hasDistanceFields) {
    matchClause = distanceCondition
  } else {
    // No string or distance matching possible (null-geo photo with no locality fields)
    return null
  }

  const result = await psql.query(`
    SELECT *,
           ST_Y("location"::geometry) AS "anchorLat",
           ST_X("location"::geometry) AS "anchorLon"
    FROM "Waves"
    WHERE "createdBy" = $1
      AND "groupingLevel" = $2
      AND "photosCount" < ${MAX_PHOTOS_PER_WAVE}
      AND (${matchClause})
    ORDER BY "createdAt" DESC
  `, params)

  // Filter by season in code
  for (const wave of result.rows) {
    if (wave.splashDate != null) {
      const waveSeasonKey = getSeasonKey(moment(wave.splashDate))
      if (waveSeasonKey === photoSeasonKey && wave.freezeMode !== 'FROZEN') {
        return wave
      }
    }
  }

  return null
}

export default async function main (uuid: string, groupingLevel: string): Promise<AutoGroupResult> {
  assertValidUuid(uuid, 'uuid')

  if (groupingLevel == null) {
    throw new Error('groupingLevel is required')
  }

  await psql.connect()
  await _assertHasSecret(uuid)

  // Acquire per-user advisory lock to prevent concurrent execution
  const lockResult = await psql.query(
    "SELECT pg_try_advisory_lock(hashtext('autoGroup:' || $1)) AS locked",
    [uuid]
  )
  if (lockResult.rows[0]?.locked !== true) {
    await psql.clean()
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: -1, wavesCreated: 0, hasMore: true, isNewWave: false }
  }

  const gl = groupingLevel

  // 1. Get ungrouped photos with LIMIT
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
    await psql.query("SELECT pg_advisory_unlock(hashtext('autoGroup:' || $1))", [uuid])
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, wavesCreated: 0, hasMore: false, isNewWave: false }
  }

  // 2. State variables
  let currentWave: any = null
  let currentWaveUuid: string | null = null
  let currentWaveName: string | null = null
  let isNewWave: boolean = false
  let photosGrouped = 0
  let wavesCreated = 0
  let wavePhotoCount = 0
  let waveSeasonKey: string | null = null
  let anchorLat: number | null = null
  let anchorLon: number | null = null

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
  let pendingWaveUuid: string | null = null

  // Two-pass: compute which photos match the current wave (string + distance)
  async function computeMatches (fromIdx: number): Promise<{ stringMatched: Set<string>, distanceMatched: Set<string> }> {
    if (currentWave == null) return { stringMatched: new Set(), distanceMatched: new Set() }

    const remaining = photos.slice(fromIdx)
    const stringMatched = new Set<string>()
    const unmatchedIds: string[] = []

    for (const p of remaining) {
      if (fitsPhotoInWave(p, currentWave, gl)) {
        stringMatched.add(p.id)
      } else {
        unmatchedIds.push(p.id)
      }
    }

    let distanceMatched = new Set<string>()
    const threshold = DISTANCE_THRESHOLDS_KM[gl]
    if (unmatchedIds.length > 0 && threshold != null && currentWave.waveUuid != null) {
      distanceMatched = await _filterPhotosInRadius(unmatchedIds, currentWave.waveUuid, threshold)
    }

    return { stringMatched, distanceMatched }
  }

  async function closeWave (): Promise<void> {
    if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
      await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
      pendingPhotoIds = []
    }

    // Persist refined name (anchor fields are stable identity — not mutated)
    if (currentWaveUuid != null && waveSeasonKey != null) {
      const mostFreqLocality = getMostFrequentLocality(localityCounts)
      const refinedGeo = buildGeoFromMostFrequent(
        mostFreqLocality,
        districtCounts, regionCounts, countryCounts,
        districtMap, regionMap, countryMap
      )
      const finalWaveName = computeWaveNameFromKey(refinedGeo, gl, waveSeasonKey) ??
        coordinateFallbackName(anchorLat, anchorLon, waveSeasonKey)

      currentWaveName = finalWaveName

      await psql.query(`
        UPDATE "Waves" SET "name" = $1
        WHERE "waveUuid" = $2
       `, [finalWaveName, currentWaveUuid])
    }

    currentWave = null
    wavePhotoCount = 0
    waveSeasonKey = null
    anchorLat = null
    anchorLon = null
    localityCounts = {}
    districtCounts = {}
    regionCounts = {}
    countryCounts = {}
    districtMap = {}
    regionMap = {}
    countryMap = {}
  }

  /**
   * Find an existing wave matching the photo's locality+season+groupingLevel,
   * or create a new wave. Sets all state variables for the current wave.
   */
  async function findOrCreateWave (photo: PhotoRow): Promise<void> {
    if (photo == null || photo.id == null) return

    const photoGeo: GeoResult = {
      locality: photo.locality,
      district: photo.district,
      region: photo.region,
      country: photo.country,
      countryCode: photo.countryCode
    }

    const photoDate = moment(photo.createdAt)
    const photoSeasonKey = getSeasonKey(photoDate)

    // Search for a matching existing wave
    const matchedWave = await findMatchingWave(uuid, gl, photo, photoSeasonKey)

    if (matchedWave != null) {
      // Resume existing wave
      currentWaveUuid = matchedWave.waveUuid
      currentWave = matchedWave
      pendingWaveUuid = matchedWave.waveUuid
      waveSeasonKey = photoSeasonKey
      anchorLat = matchedWave.anchorLat != null ? parseFloat(matchedWave.anchorLat) : null
      anchorLon = matchedWave.anchorLon != null ? parseFloat(matchedWave.anchorLon) : null
      isNewWave = false

      // Load photo count
      const countResult = await psql.query(`
        SELECT COUNT(*) AS cnt FROM "WavePhotos" WHERE "waveUuid" = $1
      `, [matchedWave.waveUuid])
      wavePhotoCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10)

      // Load existing frequency distribution for correct name refinement
      const freqResult = await psql.query(`
        SELECT p."locality", p."district", p."region", p."country", COUNT(*) AS cnt
        FROM "WavePhotos" wp
        JOIN "Photos" p ON p."id" = wp."photoId"
        WHERE wp."waveUuid" = $1
        GROUP BY p."locality", p."district", p."region", p."country"
      `, [matchedWave.waveUuid])

      // Initialize frequency maps from existing photos
      localityCounts = {}
      districtCounts = {}
      regionCounts = {}
      countryCounts = {}
      districtMap = {}
      regionMap = {}
      countryMap = {}
      for (const row of freqResult.rows) {
        const loc = String(row.locality ?? 'unknown')
        const cnt = parseInt(row.cnt, 10)
        localityCounts[loc] = (localityCounts[loc] ?? 0) + cnt
        districtMap[loc] = row.district
        regionMap[loc] = row.region
        countryMap[loc] = row.country

        const dist = String(row.district ?? 'unknown')
        const dKey = `${loc}|${dist}`
        districtCounts[dKey] = (districtCounts[dKey] ?? 0) + cnt
        regionCounts[loc] = (regionCounts[loc] ?? 0) + cnt
        countryCounts[loc] = (countryCounts[loc] ?? 0) + cnt
      }

      currentWaveName = matchedWave.name
    } else {
      // Create new wave
      waveSeasonKey = photoSeasonKey

      const waveName = computeWaveNameFromKey(photoGeo, gl, waveSeasonKey) ??
        coordinateFallbackName(photo.lat, photo.lon, waveSeasonKey)

      const splashDate = photo.createdAt
      const freezeDate = moment(photo.createdAt).add(1, 'month').format('YYYY-MM-DD HH:mm:ss.SSS')
      currentWaveUuid = await createWave(
        waveName, uuid, photo.lon, photo.lat, 50,
        splashDate,
        freezeDate,
        gl, photoGeo,
        photo.createdAt
      )

      pendingWaveUuid = currentWaveUuid
      currentWaveName = waveName
      isNewWave = true
      wavesCreated++
      wavePhotoCount = 0
      anchorLat = photo.lat
      anchorLon = photo.lon

      // Reset frequency maps for new wave
      localityCounts = {}
      districtCounts = {}
      regionCounts = {}
      countryCounts = {}
      districtMap = {}
      regionMap = {}
      countryMap = {}

      currentWave = {
        waveUuid: currentWaveUuid,
        anchorLocality: photoGeo.locality ?? null,
        anchorDistrict: photoGeo.district ?? null,
        anchorRegion: photoGeo.region ?? null,
        anchorCountry: photoGeo.country ?? null,
        anchorLat: photo.lat,
        anchorLon: photo.lon,
        groupingLevel: gl
      }
    }
  }

  // 3. Process photos using search-and-reuse approach
  // Start with the first photo — find or create wave
  await findOrCreateWave(photos[0])
  pendingPhotoIds = [photos[0].id]
  photosGrouped++
  wavePhotoCount++

  // Update frequency maps for first photo
  const firstLoc = photos[0].locality ?? 'unknown'
  localityCounts[firstLoc] = (localityCounts[firstLoc] ?? 0) + 1
  districtMap[firstLoc] = photos[0].district
  regionMap[firstLoc] = photos[0].region
  countryMap[firstLoc] = photos[0].country
  const firstDKey = `${firstLoc}|${photos[0].district ?? 'unknown'}`
  districtCounts[firstDKey] = (districtCounts[firstDKey] ?? 0) + 1
  regionCounts[firstLoc] = (regionCounts[firstLoc] ?? 0) + 1
  countryCounts[firstLoc] = (countryCounts[firstLoc] ?? 0) + 1

  // Compute matches for remaining photos
  let { stringMatched, distanceMatched } = await computeMatches(1)
  let photoIdx = 1

  while (photoIdx < photos.length) {
    const photo = photos[photoIdx]

    // Check if photo matches the current wave
    const photoMatches = stringMatched.has(photo.id) || distanceMatched.has(photo.id)

    if (!photoMatches) {
      // Skip non-matching photo — leave ungrouped for next iteration
      photoIdx++
      continue
    }

    // Photo matches — check season boundary
    const photoSeasonKey = getSeasonKey(moment(photo.createdAt))
    if (waveSeasonKey != null && photoSeasonKey !== waveSeasonKey) {
      // Season boundary — close current wave, find or create new one
      await closeWave()
      await findOrCreateWave(photo)

      pendingPhotoIds = [photo.id]
      photosGrouped++
      wavePhotoCount++

      // Update frequency maps for this photo
      const loc = photo.locality ?? 'unknown'
      localityCounts[loc] = (localityCounts[loc] ?? 0) + 1
      districtMap[loc] = photo.district
      regionMap[loc] = photo.region
      countryMap[loc] = photo.country
      const dKey = `${loc}|${photo.district ?? 'unknown'}`
      districtCounts[dKey] = (districtCounts[dKey] ?? 0) + 1
      regionCounts[loc] = (regionCounts[loc] ?? 0) + 1
      countryCounts[loc] = (countryCounts[loc] ?? 0) + 1

      const matches = await computeMatches(photoIdx + 1)
      stringMatched = matches.stringMatched
      distanceMatched = matches.distanceMatched

      photoIdx++
      continue
    }

    // Check photo count limit
    if (wavePhotoCount >= MAX_PHOTOS_PER_WAVE) {
      // Count limit — close current wave, find or create new one
      await closeWave()
      await findOrCreateWave(photo)

      pendingPhotoIds = [photo.id]
      photosGrouped++
      wavePhotoCount++

      // Update frequency maps for this photo
      const loc = photo.locality ?? 'unknown'
      localityCounts[loc] = (localityCounts[loc] ?? 0) + 1
      districtMap[loc] = photo.district
      regionMap[loc] = photo.region
      countryMap[loc] = photo.country
      const dKey = `${loc}|${photo.district ?? 'unknown'}`
      districtCounts[dKey] = (districtCounts[dKey] ?? 0) + 1
      regionCounts[loc] = (regionCounts[loc] ?? 0) + 1
      countryCounts[loc] = (countryCounts[loc] ?? 0) + 1

      const matches = await computeMatches(photoIdx + 1)
      stringMatched = matches.stringMatched
      distanceMatched = matches.distanceMatched

      photoIdx++
      continue
    }

    // Photo fits — accumulate
    pendingPhotoIds.push(photo.id)
    photosGrouped++
    wavePhotoCount++

    // Update frequency maps
    const loc = photo.locality ?? 'unknown'
    localityCounts[loc] = (localityCounts[loc] ?? 0) + 1
    districtMap[loc] = photo.district
    regionMap[loc] = photo.region
    countryMap[loc] = photo.country

    const dKey = `${loc}|${photo.district ?? 'unknown'}`
    districtCounts[dKey] = (districtCounts[dKey] ?? 0) + 1
    regionCounts[loc] = (regionCounts[loc] ?? 0) + 1
    countryCounts[loc] = (countryCounts[loc] ?? 0) + 1

    photoIdx++
  }

  // Flush remaining pending photos and update wave name
  if (pendingWaveUuid != null && pendingPhotoIds.length > 0) {
    await flushWavePhotos(pendingWaveUuid, pendingPhotoIds, uuid)
    pendingPhotoIds = []
  }

  // Backend fix: Detect and handle stale wave (zero-progress case)
  // If no photos were grouped but we have an active wave, close it to prevent
  // infinite loop when photos are counted but never inserted
  if (photosGrouped === 0 && currentWave != null) {
    await closeWave()
  }

  if (currentWaveUuid != null && waveSeasonKey != null) {
    const mostFreqLocality = getMostFrequentLocality(localityCounts)
    const refinedGeo = buildGeoFromMostFrequent(
      mostFreqLocality,
      districtCounts, regionCounts, countryCounts,
      districtMap, regionMap, countryMap
    )
    const finalWaveName = computeWaveNameFromKey(refinedGeo, gl, waveSeasonKey) ??
      coordinateFallbackName(anchorLat, anchorLon, waveSeasonKey)

    currentWaveName = finalWaveName

    await psql.query(`
      UPDATE "Waves" SET "name" = $1
      WHERE "waveUuid" = $2
     `, [finalWaveName, currentWaveUuid])
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

  await psql.query("SELECT pg_advisory_unlock(hashtext('autoGroup:' || $1))", [uuid])
  await psql.clean()
  return {
    waveUuid: currentWaveUuid,
    name: currentWaveName,
    photosGrouped,
    photosRemaining,
    wavesCreated,
    hasMore: photosRemaining > 0,
    isNewWave
  }
}
