import dayjs, { type Dayjs } from 'dayjs'

import psql from "../../psql"
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(uuid: string, description: string) {
  assertValidUuid(uuid, 'uuid')

  const createdAt = dayjs().toISOString()
  await psql.connect()
  const result = (
    await psql.query(`
                    insert into "ContactForms"
                    (
                        "uuid",
                        "description",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      $1,
                      $2,
                      $3,
                      $3
                    )
                    returning *
                    `, [uuid, description, createdAt])
  ).rows[0]
  await psql.clean()

  return result
}
