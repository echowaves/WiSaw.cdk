import * as moment from 'moment'

import sql from '../../sql'

export default async function main(uuid: string, description: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const result = (await sql`
                    insert into "ContactForms"
                    (
                        "uuid",
                        "description",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${uuid},
                      ${description},
                      ${createdAt},
                      ${createdAt}
                    )
                    returning *
                    `
                  )
  return result[0]
}
