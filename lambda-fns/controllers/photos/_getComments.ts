import sql from '../../sql'

export const _getComments = async( photoId: bigint) => {
  const result =  (await sql`
                    SELECT * FROM "Comments"
                    WHERE
                      "photoId" = ${photoId}
                      AND
                      "active" = true
                    ORDER BY "createdAt"
                    `
                  )
  return result
}
