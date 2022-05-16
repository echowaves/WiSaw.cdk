import psql from '../../psql'
import {plainToClass,} from 'class-transformer'
import Photo from '../../models/photo'

export default async function main(
  searchTerm: string,
  pageNumber: number,
  batch: string,
) {

  const limit = 3000
  const offset = pageNumber * limit

  await psql.connect()
  try {
    const results =
  (await psql.query(`
    SELECT
      row_number() OVER (ORDER BY id desc) + ${offset} as row_number,
      p.*
    FROM "Photos" p
    WHERE active = true
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
  `)
  ).rows
    await psql.clean()

    // console.log({results})
    // console.log({slicedRezults: results.slice(0, -2) })// remove 2 last elements
    const photos = results.map((photo: any) => plainToClass(Photo, photo))

    let noMoreData = false

    if( photos.length < limit ) {
      noMoreData = true
    }

    return {
      photos,
      batch,
      noMoreData: true, // for now limitind to 1 batch
    }
  } catch(err) {
    await psql.clean()
  }
  return {
    photos: {},
    batch,
    noMoreData: true,
  }
}
