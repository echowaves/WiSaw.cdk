import sql from '../../sql'

export const _getRecognitions = async( photoId: bigint) => {
  const result =  (await sql`
                    SELECT * FROM "Recognitions"
                    WHERE
                      "photoId" = ${photoId}
                    `
                  )
                  console.log({recognitions: result})
  return result[0]
}
