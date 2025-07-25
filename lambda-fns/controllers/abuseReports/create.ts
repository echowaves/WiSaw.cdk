import moment from "moment"

import psql from "../../psql"

export default async function main(photoId: string, uuid: string) {
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
                      $1,
                      $2,
                      $3,
                      $4
                    )
                    returning *
                    `, [photoId, uuid, createdAt, createdAt])
  ).rows[0]

  await psql.clean()
  return result
}
