import * as moment from 'moment'

import sql from '../../sql'

import {_updateWatchers} from './_updateWatchers'

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");

export default async function main(photoId: bigint, uuid: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

    await sql`
      DELETE FROM "Watchers"
      WHERE "photoId" = ${photoId}
        AND
      "uuid" = ${uuid}`

    await sql`
      INSERT INTO "Watchers"
        (
            "uuid",
            "photoId",
            "createdAt",
            "updatedAt",
            "watchedAt"
        ) values (
          ${uuid},
          ${photoId},
          ${createdAt},
          ${createdAt},
          ${createdAt}
        )`

  const watchersCount = await _updateWatchers(photoId, uuid)
  return watchersCount

}
