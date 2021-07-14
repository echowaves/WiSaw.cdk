import * as moment from 'moment'
import sql from '../../sql'
import { plainToClass } from 'class-transformer';
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

// import AbuseReport from '../../models/abuseReport'

export default async function main(
  searchTerm: string,
  pageNumber: number,
  batch: number,
) {
  const limit = 100
  const offset = pageNumber * limit

  const results =
  (await sql`
    SELECT
      p.*
    FROM "Photos" p
    WHERE active = true
      AND "id" in (
          SELECT "photoId"
          FROM "Recognitions"
          WHERE
          to_tsvector('English', "metaData"::text) @@ plainto_tsquery('English', '${searchTerm}') \
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
    noMoreData,
  }
}
