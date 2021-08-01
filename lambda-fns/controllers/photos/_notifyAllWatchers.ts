import * as moment from 'moment'

import sql from '../../sql'

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _notifyAllWatchers = async( photoId: bigint) => {
  // this is when it happens
  const watchedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS");

  (await sql`
    UPDATE "Watchers"
    SET "watchedAt" = ${watchedAt}
    WHERE "photoId" = ${photoId}
    `)
  return
}
