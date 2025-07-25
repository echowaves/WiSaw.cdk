import moment from "moment"

import psql from "../../psql"

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");
// select distinct "watchersCount" from "Photos" order by "watchersCount" DESC;

export const _notifyAllWatchers = async (photoId: string) => {
  // this is when it happens
  const watchedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()
  await psql.query(`
    UPDATE "Watchers"
    SET "watchedAt" = $1
    WHERE "photoId" = $2
    `, [watchedAt, photoId])
  await psql.clean()
  return
}
