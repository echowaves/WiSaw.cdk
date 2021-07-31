import * as moment from 'moment'

import { plainToClass } from 'class-transformer';

import sql from '../../sql'

import Photo from '../../models/photo'
import {_updateWatchers} from './_updateWatchers'

// update "Photos" set "watchersCount" = (select count(*) from "Watchers" where "photoId" = "Photos".id and uuid != "Photos"."uuid");

export default async function main(photoId: bigint, uuid: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")


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
        // ON CONFLICT ("uuid", "photoId")
        // DO UPDATE "Watchers" SET "watchedAt" = ${createdAt} WHERE "uuid" = ${uuid} AND "photoId" = ${photoId};`


        // const watchersCount = (await sql`
        //   SELECT COUNT(*) from "Watchers"
        //     WHERE "photoId" = ${photoId}
        //       AND "uuid" != ${uuid}
        //   `)[0].count
        //
        // console.log({watchersCount})
        //
        // await sql`
        //   UPDATE "Photos" SET "watchersCount" = ${watchersCount}
        //   WHERE id = ${photoId}`

        const watchersCount = (await sql`
                             UPDATE "Photos"
                             SET "watchersCount" = "watchersCount" + 1
                             WHERE id = ${photoId}
                             returning *
                             `
                           )[0].watchersCount

    // const watchersCount = await _updateWatchers(photoId, uuid)

    return watchersCount

}
