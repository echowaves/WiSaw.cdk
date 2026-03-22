import psql from '../../psql'
import { isValidPhotoId } from '../../utilities/isValidPhotoId'

// import Photo from '../../models/photo'

export default async function main (photoId: string, uuid: string): Promise<string> {
  // const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  if (!isValidPhotoId(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }

  await psql.connect()

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = $1
    `, [photoId])

  await psql.clean()

  return 'OK'
}
