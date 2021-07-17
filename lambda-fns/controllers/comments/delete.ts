import * as moment from 'moment'

import sql from '../../sql'

import {_updateCommentsCount} from './updateCommentsCount'

export default async function main(commentId: bigint, uuid: string) {

  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const comment = (await sql`UPDATE "Comments"
            SET
              "active" = false,
              "deactivatedBy" = ${uuid},
              "updatedAt" = ${updatedAt}
        WHERE id = ${commentId}
        returning *`
      )[0]

  await _updateCommentsCount(comment.photoId)

  return "OK"
}
