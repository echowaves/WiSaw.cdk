import {plainToClass,} from 'class-transformer'

import psql from '../../psql'

import Photo from '../../models/photo'

export const _getPhoto = async( photoId: bigint) => {
  await psql.connect()
  const result =
  (await psql.query(`
                    SELECT * FROM "Photos"
                    WHERE
                      "id" = ${photoId}
                    LIMIT 1
                    `)
  )
    .rows[0]
  await psql.clean()


  const photo = plainToClass(Photo, result)
  return photo
}
