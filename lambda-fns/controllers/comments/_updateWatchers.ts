import * as moment from 'moment'

import sql from '../../sql'

export const _updateWatchers = async( photoId: bigint) => {

  const watchedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await sql`
    UPDATE "Watchers"
    SET "watchedAt" = ${watchedAt}
    WHERE "photoId" = ${photoId}
  `
}
