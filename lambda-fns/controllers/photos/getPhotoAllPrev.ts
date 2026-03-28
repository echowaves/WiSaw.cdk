import psql from '../../psql'

import { _getComments } from './_getComments'
import { _getPhoto } from './_getPhoto'
import { _getRecognitions } from './_getRecognitions'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(
  photoId: string,
) {
  assertValidUuid(photoId, 'photoId')

  await psql.connect()

  const prevId =
  (await psql.query(`
                    SELECT "id" FROM "Photos"
                    WHERE
                      "updatedAt" < (select "updatedAt" FROM "Photos" where "id" = $1 LIMIT 1)
                    AND
                      active = true
                    ORDER BY "updatedAt" DESC
                    LIMIT 1
                    `, [photoId]
                  )).rows[0]?.id
  await psql.clean()

  if (!prevId) {
    return { photo: null, comments: [], recognitions: [] }
  }

  const [
    photo,
    comments,
    recognitions,
  ] =
    await Promise.all([
      _getPhoto(prevId),
      _getComments(prevId),
      _getRecognitions(prevId),
    ])

  return {
    photo,
    comments,
    recognitions,
  }
}
