import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

export default async function main (
  searchTerm: string,
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

  await psql.connect()
  try {
    let query = `
          SELECT
            row_number() OVER (ORDER BY id desc) + ${offset} as row_number,
            p.*
          FROM "Photos" p
    `

    if (waveUuid !== undefined) {
      query += `
        JOIN "WavePhotos" wp ON p.id = wp."photoId"
      `
    }

    query += `
          WHERE active = true
    `

    if (waveUuid !== undefined) {
      query += `
        AND wp."waveUuid" = '${waveUuid}'
      `
    }

    query += `
            AND "id" in (
                SELECT "photoId"
                FROM "Recognitions"
                WHERE
                to_tsvector('English', "metaData"::text) @@ plainto_tsquery('English', '${searchTerm}')
              UNION
                SELECT "photoId"
                FROM "Comments"
                WHERE
                  active = true AND to_tsvector('English', "comment"::text) @@ plainto_tsquery('English', '${searchTerm}')
              )
          ORDER BY id desc
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

    return {
      photos,
      batch,
      noMoreData: true // for now limitind to 1 batch
    }
  } catch (err) {
    await psql.clean()
  }
  return {
    photos: [],
    batch,
    noMoreData: true
  }
}
