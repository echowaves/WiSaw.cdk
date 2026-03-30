import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main (uuid: string): Promise<number> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const query = `
    SELECT COUNT(*)::int AS count
    FROM "WaveUsers"
    WHERE "uuid" = $1
  `

  const result = (await psql.query(query, [uuid])).rows[0]

  await psql.clean()

  return result?.count ?? 0
}
