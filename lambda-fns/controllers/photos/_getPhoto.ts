import { plainToClass, } from 'class-transformer'

import psql from '../../psql'

import Photo from '../../models/photo'

export const _getPhoto = async( photoId: string) => {
  await psql.connect()
  const result =
  (await psql.query(`
                    SELECT * FROM "Photos"
                    WHERE
                      "id" = $1
                    LIMIT 1
                    `, [photoId])
  )
    .rows[0]
  await psql.clean()


  const photo = plainToClass(Photo, result)
  return photo
}
