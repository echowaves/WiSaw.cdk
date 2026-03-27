import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

export default async function main (
  searchTerm: string,
  pageNumber: number,
  batch: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 100
  const offset = pageNumber * limit

  await psql.connect()
  try {
    const query = `
          SELECT
            row_number() OVER (ORDER BY id desc) + $2 as row_number,
            p.*
          FROM "Photos" p
          WHERE active = true

            AND "id" in (
                SELECT "photoId"
                FROM "Recognitions"
                WHERE
                to_tsvector('English', "metaData"::text) @@ plainto_tsquery('English', $1)
              UNION
                SELECT "photoId"
                FROM "Comments"
                WHERE
                  active = true AND to_tsvector('English', "comment"::text) @@ plainto_tsquery('English', $1)
              )
          ORDER BY id desc
          LIMIT $3
          OFFSET $2
    `

    const results =
      (await psql.query(query, [searchTerm, offset, limit])
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
