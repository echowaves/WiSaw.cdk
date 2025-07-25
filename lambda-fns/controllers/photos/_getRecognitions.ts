import psql from '../../psql'

export const _getRecognitions = async( photoId: string) => {
  await psql.connect()
  const results =
  (await psql.query(`
                    SELECT * FROM "Recognitions"
                    WHERE
                      "photoId" = $1
                    `, [photoId])
  ).rows
  await psql.clean()

  return results
}
