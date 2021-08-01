import * as moment from 'moment'

import sql from '../../sql'

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _updateWatchers = async( photoId: bigint, uuid: string) => {

  const count = (await sql`
    UPDATE "Photos"
      SET "watchersCount" =
        (SELECT COUNT(id) as "watchersCount" from "Watchers" where "Watchers"."photoId" = ${photoId}
        AND "Watchers"."uuid" != "Photos"."uuid")
      WHERE id = ${photoId}
      returning *`)[0]
  return count.watchersCount
}
