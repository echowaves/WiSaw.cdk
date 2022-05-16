import psql from '../../psql'

export const _getRecognitions = async( photoId: bigint) => {
  await psql.connect()
  const results =
  (await psql.query(`
                    SELECT * FROM "Recognitions"
                    WHERE
                      "photoId" = ${photoId}
                    `)
  ).rows
  await psql.clean()

  return results
}
