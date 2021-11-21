/* eslint-disable import/named */
import {plainToClass,} from 'class-transformer'

import sql from '../../sql'
import Photo from '../../models/photo'

export const _getPhoto = async( photoId: bigint) => {
  const result = (await sql`
                    SELECT * FROM "Photos"
                    WHERE
                      "id" = ${photoId}
                    LIMIT 1
                    `
  )[0]
  const photo = plainToClass(Photo, result)
  return photo
}
