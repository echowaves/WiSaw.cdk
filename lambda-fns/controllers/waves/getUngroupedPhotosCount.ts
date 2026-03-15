import psql from '../../psql'
import { validate as uuidValidate } from 'uuid'

export default async function main (uuid: string): Promise<number> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

  const query = `
    SELECT COUNT(*)::int AS count
    FROM "Photos"
    LEFT JOIN "WavePhotos" ON "Photos"."id" = "WavePhotos"."photoId"
    WHERE "Photos"."uuid" = $1
      AND "Photos"."active" = true
      AND "WavePhotos"."photoId" IS NULL
  `

  const result = (await psql.query(query, [uuid])).rows[0]

  await psql.clean()

  return result?.count ?? 0
}
