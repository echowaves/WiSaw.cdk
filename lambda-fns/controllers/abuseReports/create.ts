import * as moment from 'moment'

import sql from '../../sql'

// import AbuseReport from '../../models/abuseReport'

export default async function main(photoId: bigint, uuid: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  try {
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
                      `)
                      // console.log({result})
                      return result[0]
    } catch (error) {
        console.log({error})
        return null
    }
}
