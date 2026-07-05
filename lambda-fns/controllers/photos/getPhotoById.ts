import { plainToClass } from 'class-transformer'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

import Photo from '../../models/photo'

export default async function main (photoId: string, uuid: string) {
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const result = (
    await psql.query(`
      SELECT *
              FROM "Photos"
              WHERE "id" = $1
                AND "uuid" = $2
     `, [photoId, uuid])
     )

  await psql.clean()

  if (result.rows.length === 0) {
    return null
  }

  return plainToClass(Photo, result.rows[0])
}
