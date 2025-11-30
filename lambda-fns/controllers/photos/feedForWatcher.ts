import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

// import AbuseReport from '../../models/abuseReport'

export default async function main (
  uuid: string,
  pageNumber: number,
  batch: string,
  waveUuid?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 100
  const offset = pageNumber * limit
  // console.log({uuid})
  await psql.connect()

  let query = `
    SELECT
      row_number() OVER (ORDER BY w."watchedAt" DESC) + ${offset} as row_number,
      p.*
    FROM "Photos" p
    INNER JOIN "Watchers" w
      ON p.id = w."photoId"
  `

  if (waveUuid !== undefined) {
    query += `
      JOIN "WavePhotos" wp ON p.id = wp."photoId"
    `
  }

  query += `
    WHERE
      w.uuid = '${uuid}'
    AND p.active = true
  `

  if (waveUuid !== undefined) {
    query += `
      AND wp."waveUuid" = '${waveUuid}'
    `
  }

  query += `
    ORDER BY w."watchedAt" DESC
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
