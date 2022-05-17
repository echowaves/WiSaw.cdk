import psql from '../../psql'

import {_getPhoto} from './_getPhoto'
import {_getComments} from './_getComments'
import {_getRecognitions} from './_getRecognitions'

export default async function main(
  photoId: bigint,
) {
  await psql.connect()

  const result =
  (await psql.query(`
                      SELECT "id" FROM "Photos"
                    WHERE
                      "id" < ${photoId}
                    AND
                      active = true
                    ORDER BY id DESC
                    LIMIT 1
                    `
                  )).rows[0]?.id || 2147483640
  await psql.clean()

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
