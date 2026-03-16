import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'

// import AbuseReport from '../../models/abuseReport'

export default async function main (
  pageNumber: number,
  batch: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 20
  const offset = pageNumber * limit
  // console.log({uuid})
  await psql.connect()

  const query = `
    SELECT
      "Photos".*
    FROM "Photos"
    WHERE
      active = true
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
