import sql from '../../sql'

export const _getComments = async( photoId: bigint) => {
  const result =  (await sql`
                    SELECT * FROM "Comments"
                    WHERE "photoId" = ${photoId}
                    `
                  )
                  console.log({comments: result})
  return result[0]
}
