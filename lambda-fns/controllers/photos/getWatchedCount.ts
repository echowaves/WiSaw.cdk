import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main (uuid: string): Promise<number> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const query = `
    SELECT COUNT(*)::int AS count
    FROM "Watchers" w
    INNER JOIN "Photos" p ON p.id = w."photoId"
    WHERE w."uuid" = $1
      AND p.active = true
  `

  const result = (await psql.query(query, [uuid])).rows[0]

  await psql.clean()

  return result?.count ?? 0
}
