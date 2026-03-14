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

interface ClusteredPhoto {
  id: string
  lat: number
  lon: number
  createdAt: string
  cluster_id: number
}

interface UngroupedPhoto {
  id: string
  createdAt: string
}

interface TemporalCluster {
  photos: ClusteredPhoto[]
  centroidLat: number
  centroidLon: number
  earliestDate: string
  latestDate: string
}

const SPATIAL_EPSILON = 50 * 0.009 // ~50km in degrees
const TEMPORAL_GAP_DAYS = 30

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

function splitByTemporalGaps (photos: ClusteredPhoto[]): TemporalCluster[] {
  if (photos.length === 0) return []

  const sorted = [...photos].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const clusters: TemporalCluster[] = []
  let current: ClusteredPhoto[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].createdAt).getTime()
    const curr = new Date(sorted[i].createdAt).getTime()
    const gapDays = (curr - prev) / (1000 * 60 * 60 * 24)

    if (gapDays > TEMPORAL_GAP_DAYS) {
      clusters.push(buildTemporalCluster(current))
      current = [sorted[i]]
    } else {
      current.push(sorted[i])
    }
  }
  clusters.push(buildTemporalCluster(current))

  return clusters
}

function buildTemporalCluster (photos: ClusteredPhoto[]): TemporalCluster {
  const latSum = photos.reduce((s, p) => s + p.lat, 0)
  const lonSum = photos.reduce((s, p) => s + p.lon, 0)
  const dates = photos.map(p => new Date(p.createdAt).getTime())

  return {
    photos,
    centroidLat: latSum / photos.length,
    centroidLon: lonSum / photos.length,
    earliestDate: new Date(Math.min(...dates)).toISOString(),
    latestDate: new Date(Math.max(...dates)).toISOString()
  }
}

function splitUngroupedByTemporalGaps (photos: UngroupedPhoto[]): UngroupedPhoto[][] {
  if (photos.length === 0) return []

  const sorted = [...photos].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const groups: UngroupedPhoto[][] = []
  let current: UngroupedPhoto[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].createdAt).getTime()
    const curr = new Date(sorted[i].createdAt).getTime()
    const gapDays = (curr - prev) / (1000 * 60 * 60 * 24)

    if (gapDays > TEMPORAL_GAP_DAYS) {
      groups.push(current)
      current = [sorted[i]]
    } else {
      current.push(sorted[i])
    }
  }
  groups.push(current)

  return groups
}

async function countRemainingUngrouped (uuid: string): Promise<number> {
  const result = await psql.query(`
    SELECT COUNT(*)::int AS count
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
  `, [uuid])
  return result.rows[0].count
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
    `, [waveUuid, waveName, '', uuid, lon, lat, 50, now, now])
  } else {
    await psql.query(`
      INSERT INTO "Waves" (
        "waveUuid", "name", "description", "createdBy",
        "location", "radius", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4,
        NULL, $5, $6, $7
      )
    `, [waveUuid, waveName, '', uuid, 50, now, now])
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

async function handleUnresolvablePhotos (uuid: string): Promise<AutoGroupResult> {
  // Query all ungrouped photos without location
  const locationlessResult = await psql.query(`
    SELECT "Photos".id, "Photos"."createdAt"
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
      AND "Photos".location IS NULL
  `, [uuid])

  const unresolvablePhotos: UngroupedPhoto[] = locationlessResult.rows.map((row: any) => ({
    id: row.id,
    createdAt: row.createdAt
  }))

  if (unresolvablePhotos.length === 0) {
    return { waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, hasMore: false }
  }

  // Check if the user has any existing waves
  const wavesResult = await psql.query(`
    SELECT w."waveUuid", MIN(p."createdAt") AS "earliestDate", MAX(p."createdAt") AS "latestDate"
    FROM "Waves" w
    INNER JOIN "WaveUsers" wu ON w."waveUuid" = wu."waveUuid"
    LEFT JOIN "WavePhotos" wp ON w."waveUuid" = wp."waveUuid"
    LEFT JOIN "Photos" p ON wp."photoId" = p.id
    WHERE wu."uuid" = $1
    GROUP BY w."waveUuid"
  `, [uuid])

  if (wavesResult.rows.length > 0) {
    // Assign each unresolvable photo to the nearest wave in time
    const waves = wavesResult.rows.map((row: any) => {
      const earliest = new Date(row.earliestDate).getTime()
      const latest = new Date(row.latestDate).getTime()
      return {
        waveUuid: row.waveUuid as string,
        midpoint: (earliest + latest) / 2
      }
    })

    const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
    for (const photo of unresolvablePhotos) {
      const photoTime = new Date(photo.createdAt).getTime()
      let nearestWaveUuid = waves[0].waveUuid
      let nearestDistance = Math.abs(photoTime - waves[0].midpoint)

      for (let i = 1; i < waves.length; i++) {
        const distance = Math.abs(photoTime - waves[i].midpoint)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestWaveUuid = waves[i].waveUuid
        }
      }

      await psql.query(`
        INSERT INTO "WavePhotos" (
          "waveUuid", "photoId", "createdBy", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("waveUuid", "photoId") DO NOTHING
      `, [nearestWaveUuid, photo.id, uuid, now, now])
    }

    const photosRemaining = await countRemainingUngrouped(uuid)
    return {
      waveUuid: null,
      name: null,
      photosGrouped: unresolvablePhotos.length,
      photosRemaining,
      hasMore: false
    }
  }

  // No existing waves — create catch-all waves with temporal splitting
  const temporalGroups = splitUngroupedByTemporalGaps(unresolvablePhotos)
  let totalGrouped = 0
  let lastWaveUuid: string | null = null
  let lastWaveName: string | null = null

  for (const group of temporalGroups) {
    const dates = group.map(p => new Date(p.createdAt).getTime())
    const earliest = moment(new Date(Math.min(...dates)))
    const latest = moment(new Date(Math.max(...dates)))
    const dateRange = formatDateRange(earliest, latest)
    const waveName = `Uncategorized, ${dateRange}`

    const photoIds = group.map(p => p.id)
    lastWaveUuid = await createWaveAndAssign(waveName, uuid, photoIds, null, null)
    lastWaveName = waveName
    totalGrouped += group.length
  }

  const photosRemaining = await countRemainingUngrouped(uuid)
  return {
    waveUuid: lastWaveUuid,
    name: lastWaveName,
    photosGrouped: totalGrouped,
    photosRemaining,
    hasMore: false
  }
}

export default async function main (uuid: string): Promise<AutoGroupResult> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

  // Spatial clustering of ungrouped photos (only those with location)
  const clusterQuery = `
    WITH photo_clusters AS (
      SELECT
        "Photos".id,
        ST_Y("Photos".location::geometry) AS lat,
        ST_X("Photos".location::geometry) AS lon,
        "Photos"."createdAt",
        ST_ClusterDBSCAN("Photos".location::geometry, eps := $2, minpoints := 1) OVER () AS cluster_id
      FROM "Photos"
      LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
      WHERE "Photos".uuid = $1
        AND "Photos".active = true
        AND "WavePhotos"."photoId" IS NULL
        AND "Photos".location IS NOT NULL
    )
    SELECT id, lat, lon, "createdAt", cluster_id
    FROM photo_clusters
    ORDER BY cluster_id, "createdAt"
  `

  const clusterResult = await psql.query(clusterQuery, [uuid, SPATIAL_EPSILON])
  const photos: ClusteredPhoto[] = clusterResult.rows.map((row: any) => ({
    id: row.id,
    lat: parseFloat(row.lat),
    lon: parseFloat(row.lon),
    createdAt: row.createdAt,
    cluster_id: parseInt(row.cluster_id, 10)
  }))

  // If no located photos to cluster, handle unresolvable photos
  if (photos.length === 0) {
    const result = await handleUnresolvablePhotos(uuid)
    await psql.clean()
    return result
  }

  // Group by spatial cluster_id
  const spatialClusters = new Map<number, ClusteredPhoto[]>()
  for (const photo of photos) {
    const existing = spatialClusters.get(photo.cluster_id)
    if (existing != null) {
      existing.push(photo)
    } else {
      spatialClusters.set(photo.cluster_id, [photo])
    }
  }

  // For each spatial cluster, split by temporal gaps
  const allTemporalClusters: TemporalCluster[] = []
  for (const clusterPhotos of spatialClusters.values()) {
    allTemporalClusters.push(...splitByTemporalGaps(clusterPhotos))
  }

  // Sort by earliest date ascending and process only the oldest cluster
  allTemporalClusters.sort(
    (a, b) => new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime()
  )
  const cluster = allTemporalClusters[0]

  // Geocode the oldest cluster (one HTTP call max per invocation)
  const locationName = await reverseGeocode(cluster.centroidLat, cluster.centroidLon)

  // Build wave name — use "Uncategorized" fallback if geocoding fails
  const earliest = moment(cluster.earliestDate)
  const latest = moment(cluster.latestDate)
  const dateRange = formatDateRange(earliest, latest)
  const waveName = locationName != null
    ? `${locationName}, ${dateRange}`
    : `Uncategorized, ${dateRange}`

  // Create wave and assign photos (NULL location if geocoding failed)
  const photoIds = cluster.photos.map(p => p.id)
  const lon = locationName != null ? cluster.centroidLon : null
  const lat = locationName != null ? cluster.centroidLat : null
  const waveUuid = await createWaveAndAssign(waveName, uuid, photoIds, lon, lat)

  // Count remaining ungrouped photos (including locationless)
  const photosRemaining = await countRemainingUngrouped(uuid)

  await psql.clean()

  return {
    waveUuid,
    name: waveName,
    photosGrouped: cluster.photos.length,
    photosRemaining,
    hasMore: photosRemaining > 0
  }
}
