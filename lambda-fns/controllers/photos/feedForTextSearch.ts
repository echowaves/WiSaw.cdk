import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { buildSearchClause } from '../../utilities/searchClause'

export default async function main (
  searchTerm: string,
  pageNumber: number,
  batch: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  const limit = 100
  const offset = pageNumber * limit

  await psql.connect()
  try {
    const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

    const query = `
          SELECT
            row_number() OVER (ORDER BY id desc) + $1 as row_number,
            p.*
          FROM "Photos" p
          WHERE active = true
            ${searchClause}
          ORDER BY id desc
          LIMIT $2
          OFFSET $1
    `

    const results =
      (await psql.query(query, [offset, limit, ...searchParams])
      ).rows
    await psql.clean()

    // console.log({results})
    // console.log({slicedRezults: results.slice(0, -2) })// remove 2 last elements
    const photos = results.map((photo: any) => plainToClass(Photo, photo))

    return {
      photos,
      batch,
      noMoreData: true, // for now limitind to 1 batch
      nextPage: null
    }
  } catch (err) {
    await psql.clean()
  }
  return {
    photos: [],
    batch,
    noMoreData: true,
    nextPage: null
  }
}
