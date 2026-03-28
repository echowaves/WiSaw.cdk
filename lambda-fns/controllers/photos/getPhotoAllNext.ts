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

  const nextId =
  (await psql.query(`
                    SELECT "id" FROM "Photos"
                    WHERE
                      "updatedAt" > (select "updatedAt" FROM "Photos" where "id" = $1 LIMIT 1)
                    AND
                      active = true
                    ORDER BY "updatedAt" ASC
                    LIMIT 1
                    `, [photoId]
                  )).rows[0]?.id

  await psql.clean()

  if (!nextId) {
    return { photo: null, comments: [], recognitions: [] }
  }

  const [
    photo,
    comments,
    recognitions,
  ] =
    await Promise.all([
      _getPhoto(nextId),
      _getComments(nextId),
      _getRecognitions(nextId),
    ])

  return {
    photo,
    comments,
    recognitions,
  }
}
