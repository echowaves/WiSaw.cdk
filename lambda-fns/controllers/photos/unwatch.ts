import * as moment from 'moment'

import { plainToClass } from 'class-transformer';

import sql from '../../sql'

import Photo from '../../models/photo'
import {_updateWatchers} from './_updateWatchers'

export default async function main(photoId: bigint, uuid: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
    await sql`
      DELETE FROM "Watchers"
      WHERE "photoId" = ${photoId}
        AND
      "uuid" = ${uuid}`

    // const watchersCount = await _updateWatchers(photoId, uuid)
    const watchersCount = (await sql`
                         UPDATE "Photos"
                         SET "watchersCount" = "watchersCount" - 1
                         WHERE id = ${photoId}
                         returning *
                         `
                       )[0].watchersCount

    return watchersCount
}
