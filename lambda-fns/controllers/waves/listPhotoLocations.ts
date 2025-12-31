import psql from '../../psql'
import { validate as uuidValidate } from 'uuid'

interface PhotoLocation {
  lat: number
  lng: number
  photoCount: number
  oldestPhotoDate: string
  newestPhotoDate: string
}

export default async function main (
  uuid: string,
  radius: number = 50
): Promise<PhotoLocation[]> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  // Ensure radius is a positive number
  const clusterRadius = Math.max(1, Number.isNaN(radius) || radius === 0 ? 50 : radius)

  // Convert to approximate degrees for PostGIS
  // 1 degree latitude ≈ 111 km, so 1 km ≈ 0.009 degrees
  const epsilonDegrees = clusterRadius * 0.009

  await psql.connect()

  // Use ST_ClusterDBSCAN to cluster photos by location
  // minPoints = 1 means even single photos form a cluster
  const query = `
    WITH photo_clusters AS (
      SELECT
        "Photos".id,
        "Photos".location,
        "Photos"."createdAt",
        ST_ClusterDBSCAN(location, eps := $2, minpoints := 1) OVER () AS cluster_id
      FROM "Photos"
      LEFT JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
      WHERE "Photos".uuid = $1
        AND "Photos".active = true
        AND "WavePhotos"."photoId" IS NULL
    )
    SELECT
      AVG(ST_Y(location)) AS lat,
      AVG(ST_X(location)) AS lng,
      COUNT(*) AS "photoCount",
      MIN("createdAt") AS "oldestPhotoDate",
      MAX("createdAt") AS "newestPhotoDate"
    FROM photo_clusters
    GROUP BY cluster_id
    ORDER BY "newestPhotoDate" DESC
  `

  const results = (await psql.query(query, [uuid, epsilonDegrees])).rows
  await psql.clean()

  const locations: PhotoLocation[] = results.map((row: any) => ({
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lng),
    photoCount: parseInt(row.photoCount, 10),
    oldestPhotoDate: row.oldestPhotoDate,
    newestPhotoDate: row.newestPhotoDate
  }))

  return locations
}
