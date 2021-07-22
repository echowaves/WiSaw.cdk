import sql from '../../sql'

import {_getPhoto} from './_getPhoto'
import {_getComments} from './_getComments'
import {_getRecognitions} from './_getRecognitions'

export default async function main(
  photoId: bigint,
) {
  const result =  (await sql`
                    SELECT "id" FROM "Photos"
                    WHERE
                      "id" > ${photoId}
                    AND
                      active = true
                    ORDER BY id ASC
                    LIMIT 1
                    `
                  )[0]?.id || 0

  const [
    photo,
    comments,
    recognitions,
  ] =
    await Promise.all([
      _getPhoto(result),
      _getComments(result),
      _getRecognitions(result),
    ])



  return {
    photo,
    comments,
    recognitions,
  }
}
