import https from 'https'
import { v4 as uuidv4, validate as uuidValidate } from 'uuid'
import moment from 'moment'
import psql from '../../psql'

interface AutoGroupResult {
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
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&format=json`
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

function formatCoordinateName (lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(1)}°${latDir} ${Math.abs(lon).toFixed(1)}°${lonDir}`
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

export default async function main (uuid: string): Promise<AutoGroupResult> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

  // Spatial clustering of ungrouped photos
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

  if (photos.length === 0) {
    await psql.clean()
    return { photosGrouped: 0, photosRemaining: 0, hasMore: false }
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

  // Sort by earliest date ascending and process only the first (oldest) cluster
  allTemporalClusters.sort(
    (a, b) => new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime()
  )
  const cluster = allTemporalClusters[0]

  // Geocode the centroid
  const locationName = await reverseGeocode(cluster.centroidLat, cluster.centroidLon)

  // Build wave name
  const earliest = moment(cluster.earliestDate)
  const latest = moment(cluster.latestDate)
  const dateRange = formatDateRange(earliest, latest)
  const location = locationName ?? formatCoordinateName(cluster.centroidLat, cluster.centroidLon)
  const waveName = `${location}, ${dateRange}`

  // Create wave
  const waveUuid = uuidv4()
  const now = moment().format('YYYY-MM-DD HH:mm:ss.SSS')

  await psql.query(`
    INSERT INTO "Waves" (
      "waveUuid", "name", "description", "createdBy",
      "location", "radius", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4,
      ST_MakePoint($5, $6), $7, $8, $9
    )
  `, [waveUuid, waveName, '', uuid, cluster.centroidLon, cluster.centroidLat, 50, now, now])

  // Add user to wave
  await psql.query(`
    INSERT INTO "WaveUsers" (
      "waveUuid", "uuid", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4)
  `, [waveUuid, uuid, now, now])

  // Associate all photos with the wave
  for (const photo of cluster.photos) {
    await psql.query(`
      INSERT INTO "WavePhotos" (
        "waveUuid", "photoId", "createdBy", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("waveUuid", "photoId") DO NOTHING
    `, [waveUuid, photo.id, uuid, now, now])
  }

  // Count remaining ungrouped photos
  const remainingResult = await psql.query(`
    SELECT COUNT(*)::int AS count
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    WHERE "Photos".uuid = $1
      AND "Photos".active = true
      AND "WavePhotos"."photoId" IS NULL
      AND "Photos".location IS NOT NULL
  `, [uuid])
  const photosRemaining: number = remainingResult.rows[0].count

  await psql.clean()

  return {
    photosGrouped: cluster.photos.length,
    photosRemaining,
    hasMore: photosRemaining > 0
  }
}
