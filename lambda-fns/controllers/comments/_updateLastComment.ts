import * as moment from 'moment'

import sql from '../../sql'

// UPDATE "Photos"
//   SET "lastComment" =
//     (
//       SELECT
//         COALESCE(
//           (
//             SELECT "comment" from "Comments" where "Comments"."photoId" = "Photos"."id"
//             AND "Comments"."active" = true
//             ORDER BY "Comments"."createdAt" DESC
//             LIMIT 1
//           ),
//           ''
//         ) AS "comment"
//     )

export const _updateLastComment = async( photoId: bigint) => {

  const photo = (await sql`
    UPDATE "Photos"
      SET "lastComment" =
        (
          SELECT
            COALESCE(
              (
                SELECT "comment" from "Comments" where "Comments"."photoId" = "Photos"."id"
                AND "Comments"."active" = true
                ORDER BY "Comments"."createdAt" DESC
                LIMIT 1
              ),
              ''
            ) AS "comment"
        )
      WHERE id = ${photoId}
      returning *`)[0]
  return photo.lastComment
}
