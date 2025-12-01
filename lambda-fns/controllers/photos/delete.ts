import psql from '../../psql'

// import Photo from '../../models/photo'

export default async function main (photoId: string, uuid: string): Promise<string> {
  // const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  await psql.connect()

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = $1
    `, [photoId])

  await psql.clean()

  return 'OK'
}
