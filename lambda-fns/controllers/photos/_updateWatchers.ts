import * as moment from 'moment'

import sql from '../../sql'

export const _updateWatchers = async( photoId: bigint, uuid: string) => {

  const watchedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // await sql`
  //   UPDATE "Watchers"
  //   SET "watchedAt" = ${watchedAt}
  //   WHERE "photoId" = ${photoId}
  //   AND "uuid" = ${uuid}
  // `

  const watchersCount = (await sql`
    SELECT COUNT(*) from "Watchers"
      WHERE "photoId" = ${photoId}
        AND "uuid" != ${uuid}
    `)[0].count

  console.log({watchersCount})

  await sql`
    UPDATE "Photos" SET "watchersCount" = ${watchersCount}
    WHERE id = ${photoId}`

  return watchersCount
}
