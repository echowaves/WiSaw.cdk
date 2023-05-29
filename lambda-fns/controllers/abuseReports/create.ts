import moment from "moment"

import psql from "../../psql"

export default async function main(photoId: bigint, uuid: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  await psql.connect()
  const result = (
    await psql.query(`
                    insert into "AbuseReports"
                    (
                        "photoId",
                        "uuid",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${photoId},
                      '${uuid}',
                      '${createdAt}',
                      '${createdAt}'
                    )
                    returning *
                    `)
  ).rows[0]

  await psql.clean()
  return result
}
