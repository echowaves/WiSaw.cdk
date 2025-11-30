import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

// import AbuseReport from '../../models/abuseReport'

export default async function main (
  pageNumber: number,
  batch: string,
  waveUuid?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 20
  const offset = pageNumber * limit
  // console.log({uuid})
  await psql.connect()

  let query = `
    SELECT
      "Photos".*
    FROM "Photos"
  `

  if (waveUuid !== undefined) {
    query += `
      JOIN "WavePhotos" ON "Photos".id = "WavePhotos"."photoId"
    `
  }

  query += `
    WHERE
      active = true
  `

  if (waveUuid !== undefined) {
    query += `
      AND "WavePhotos"."waveUuid" = '${waveUuid}'
    `
  }

  query += `
    ORDER BY "Photos"."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results =
  (await psql.query(query)
  ).rows
  await psql.clean()

  // console.log({results})
  // console.log({slicedRezults: results.slice(0, -2) })// remove 2 last elements
  const photos = results.map((photo: any) => plainToClass(Photo, photo))

  let noMoreData = false

  if (photos.length < limit) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData
  }
}
