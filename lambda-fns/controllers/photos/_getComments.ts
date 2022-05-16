import psql from '../../psql'

export const _getComments = async( photoId: bigint) => {
  await psql.connect()
  const results =
  (await psql.query(`
                    SELECT * FROM "Comments"
                    WHERE
                      "photoId" = ${photoId}
                      AND
                      "active" = true
                    ORDER BY "createdAt"
                    `)
  ).rows
  await psql.clean()

  return results
}
