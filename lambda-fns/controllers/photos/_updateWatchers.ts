// import * as moment from 'moment'

import psql from '../../psql'

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _updateWatchers = async( photoId: bigint, uuid: string) => {

  const count =
  (await psql.query(`
  UPDATE "Photos"
      SET "watchersCount" =
        (SELECT COUNT(id) as "watchersCount" from "Watchers" where "Watchers"."photoId" = ${photoId}
        AND "Watchers"."uuid" != "Photos"."uuid")
      WHERE id = ${photoId}
      returning *`)).rows[0]
  return count.watchersCount
}
