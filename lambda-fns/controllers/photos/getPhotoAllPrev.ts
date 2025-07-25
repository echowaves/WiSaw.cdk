import psql from '../../psql'

import { _getComments } from './_getComments'
import { _getPhoto } from './_getPhoto'
import { _getRecognitions } from './_getRecognitions'

export default async function main(
  photoId: string,
) {
  await psql.connect()

  const result =
  (await psql.query(`
                    SELECT "id" FROM "Photos"
                    WHERE
                      "updatedAt" < (select "updatedAt" FROM "Photos" where "id" = $1 ORDER BY "id" ASC LIMIT 1)
                    AND
                      active = true
                    ORDER BY "updatedAt" DESC
                    LIMIT 1
                    `, [photoId]
                  )).rows[0]?.id || '2147483640'
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
