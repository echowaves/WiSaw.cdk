import * as moment from 'moment'

import sql from '../../sql'

export default async function main(photoId: bigint, uuid: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const result = (await sql`
                    insert into "AbuseReports"
                    (
                        "photoId",
                        "uuid",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${photoId},
                      ${uuid},
                      ${createdAt},
                      ${createdAt}
                    )
                    returning *
                    `
                  )
  return result[0]
}
