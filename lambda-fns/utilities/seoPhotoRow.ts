// One row shape for every writer of an SEO sidecar, in exactly one place.
//
// A sidecar is overwritten whole, so a writer that selects fewer columns silently strips enriched
// text from an already-indexed page: this script used to list its columns by hand, never learned
// about the "duration" column ticket 8 added, and every video record it published lost its
// duration - silently, because a PUT does not move "updatedAt", so the scheduled refresh had no
// reason to come back and put it right. What differs between the single-photo refresh, the
// scheduled publisher and the operator backfill is WHICH rows they want, never HOW a row is
// shaped, so only the tail of the statement is a caller's business.
//
// p."location" - the geography column - arrives with p.* and is never read by anyone: a record's
// place name is composed from locality/district/region alone, and assertNoPreciseLocation screens
// what does get composed, so a value that reads like a position stops that write instead of being
// published.

export const SEO_ROW_SELECT = `
  SELECT
    p.*,
    COALESCE(r."labels", '[]'::jsonb) AS "labels"
  FROM "Photos" p
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(l ->> 'Name') AS "labels"
    FROM "Recognitions" rec,
         -- Older Rekognition payloads store Labels as a scalar; unwinding one of those aborts
         -- the whole statement (22023) and takes the caller's job with it.
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(rec."metaData" -> 'Labels') = 'array'
                THEN rec."metaData" -> 'Labels'
                ELSE '[]'::jsonb END
         ) l
    WHERE rec."photoId" = p."id"
      AND coalesce(l ->> 'Name', '') <> ''
  ) r ON true
`

export interface SeoRowQueryOptions {
  /** SQL predicate selecting the rows, without the WHERE keyword. */
  where?: string
  /** ORDER BY expression, without the ORDER BY keywords. */
  orderBy?: string
  /** Row cap; anything but a positive integer means no LIMIT clause. */
  limit?: number
}

// The tail is built from code-authored fragments only - callers pass SQL keywords-free pieces, and
// the limit is coerced to an integer rather than interpolated as given.
export function seoRowQuery (options: SeoRowQueryOptions = {}): string {
  const { where, orderBy, limit } = options
  const cap = Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 0
  const tail = [
    where != null && String(where).trim() !== '' ? `WHERE ${String(where).trim()}` : '',
    orderBy != null && String(orderBy).trim() !== '' ? `ORDER BY ${String(orderBy).trim()}` : '',
    cap > 0 ? `LIMIT ${cap}` : ''
  ].filter((piece) => piece !== '').join('\n    ')

  return `${SEO_ROW_SELECT}${tail === '' ? '' : `\n  ${tail}\n`}`
}
