import psql from '../../psql'

export const _getComments = async( photoId: string) => {
  await psql.connect()
  const results =
  (await psql.query(`
                    SELECT * FROM "Comments"
                    WHERE
                      "photoId" = $1
                      AND
                      "active" = true
                    ORDER BY "createdAt"
                    `, [photoId])
  ).rows
  await psql.clean()

  return results
}
