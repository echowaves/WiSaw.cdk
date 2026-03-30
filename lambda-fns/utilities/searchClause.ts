export function buildSearchClause (
  searchTerm: string | null | undefined,
  paramStartIndex: number
): { clause: string, params: any[] } {
  if (!searchTerm) {
    return { clause: '', params: [] }
  }

  const clause = `
          AND p."id" IN (
              SELECT "photoId"
              FROM "Recognitions"
              WHERE
              to_tsvector('English', "metaData"::text) @@ plainto_tsquery('English', $${paramStartIndex})
            UNION
              SELECT "photoId"
              FROM "Comments"
              WHERE
                active = true AND to_tsvector('English', "comment"::text) @@ plainto_tsquery('English', $${paramStartIndex})
            )`

  return { clause, params: [searchTerm] }
}
