import sql from '../../sql'

export const _getRecognitions = async( photoId: bigint) => {
  const result =  await sql`
                    SELECT * FROM "Recognitions"
                    WHERE
                      "photoId" = ${photoId}
                    `                  
  return result
}
