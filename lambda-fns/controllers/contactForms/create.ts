import moment from "moment"

import psql from "../../psql"
import { isValidDeviceUuid } from '../../utilities/isValidDeviceUuid'

export default async function main(uuid: string, description: string) {
  if (!isValidDeviceUuid(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
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
