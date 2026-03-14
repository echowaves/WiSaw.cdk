import https from 'https'
import { v4 as uuidv4, validate as uuidValidate } from 'uuid'
import moment from 'moment'
import psql from '../../psql'

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

const DISTANCE_THRESHOLD_KM = 100
const MAX_PHOTOS_PER_WAVE = 1000

async function reverseGeocode (lat: number, lon: number): Promise<string | null> {
  return await new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&format=json&accept-language=en`
    const options = {
      headers: {
        'User-Agent': 'WiSaw-App/1.0 (https://wisaw.com)'
      }
    }

    https.get(url, options, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const address = json.address
          if (address != null) {
            const name = address.city ?? address.town ?? address.village ?? address.county ?? address.state ?? null
            resolve(name)
          } else {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
    }).on('error', () => {
      resolve(null)
    })
  })
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

async function createWaveAndAssign (
  waveName: string, uuid: string, photoIds: string[],
  lon: number | null, lat: number | null
): Promise<string> {
  const waveUuid = uuidv4()
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  if (lon != null && lat != null) {
    await psql.query(`
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy",
        "location", "radius", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        ST_MakePoint($5, $6), $7, $8, $9
      )
    `, [waveUuid, waveName, '', uuid, lon, lat, 100, now, now])
  } else {
    await psql.query(`
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy",
        "location", "radius", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        NULL, $5, $6, $7
      )
    `, [waveUuid, waveName, '', uuid, 100, now, now])
  }

  await psql.query(`
    INSERT INTO "WaveUsers" (
      "waveUuid", "uuid", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4)
  `, [waveUuid, uuid, now, now])

  for (const photoId of photoIds) {
    await psql.query(`
      INSERT INTO "WavePhotos" (
        "waveUuid", "photoId", "createdBy", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("waveUuid", "photoId") DO NOTHING
    `, [waveUuid, photoId, uuid, now, now])
  }

  return waveUuid
}

export default async function main (uuid: string): Promise<AutoGroupResult> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

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
    const waveName = `Uncategorized, ${dateRange}`

    const waveUuid = await createWaveAndAssign(waveName, uuid, photoIds, null, null)

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

  // Walk forward from the beginning, collecting photos within 50km of anchor or locationless
  const collected: Photo[] = []
  for (const photo of photos) {
    if (photo.lat == null || photo.lon == null) {
      // Locationless — include
      collected.push(photo)
    } else {
      const distance = haversineDistance(anchorLat, anchorLon, photo.lat, photo.lon)
      if (distance <= DISTANCE_THRESHOLD_KM) {
        collected.push(photo)
      } else {
        // Location break — stop
        break
      }
    }
  }

  // Geocode the anchor
  const locationName = await reverseGeocode(anchorLat, anchorLon)

  const earliest = moment(collected[0].createdAt)
  const latest = moment(collected[collected.length - 1].createdAt)
  const dateRange = formatDateRange(earliest, latest)
  const waveName = locationName != null
    ? `${locationName}, ${dateRange}`
    : `Uncategorized, ${dateRange}`

  const photoIds = collected.map(p => p.id)
  const waveUuid = await createWaveAndAssign(
    waveName, uuid, photoIds,
    anchorLon, anchorLat
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
