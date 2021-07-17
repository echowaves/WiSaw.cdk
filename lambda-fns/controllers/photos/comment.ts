import * as moment from 'moment'

import sql from '../../sql'

export default async function main(photoId: bigint, uuid: string, description: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const comment = (await sql`
    INSERT INTO "Comments"
      (
          "photoId",
          "uuid",
          "comment",
          "createdAt",
          "updatedAt"
      ) values (
        ${photoId},
        ${uuid},
        ${description},
        ${createdAt},
        ${createdAt}
      )
      returning *
      `
    )[0]

  return comment
}
