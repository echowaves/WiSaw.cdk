import moment from "moment"

import psql from "../../psql"

export default async function main(uuid: string, description: string) {
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
                      '${uuid}',
                      '${description}',
                      '${createdAt}',
                      '${createdAt}'
                    )
                    returning *
                    `)
  ).rows[0]
  await psql.clean()

  return result
}
