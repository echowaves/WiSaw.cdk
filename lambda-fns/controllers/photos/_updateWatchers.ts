import * as moment from 'moment'

import sql from '../../sql'

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
