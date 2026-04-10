import psql from '../../psql'

export const _assertHasSecret = async (uuid: string): Promise<void> => {
  const result = await psql.query(`
    SELECT 1 FROM "Secrets"
    WHERE "uuid" = $1
  `, [uuid])

  if (result.rows.length === 0) {
    throw new Error('You must register an identity (secret) to perform this action')
  }
}
