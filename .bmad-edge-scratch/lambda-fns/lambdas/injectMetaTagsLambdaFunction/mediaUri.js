/* eslint-env node */
/* global module */

// Single source of truth for what a photo/video URL is allowed to look like. The
// injector used to accept any string, so /photos/ABC/, /photos/abc/upload and
// /photos/<UPPERCASE UUID> all rendered a page that canonicalised itself - Google
// then indexed several copies of one photo, which is the duplicate-content failure
// this module exists to prevent. CloudFront lower-cases nothing, so validation and
// lower-casing happen here and everywhere derives its canonical from the result.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Legacy app links carry /full and /thumb suffixes after the id; they are routes,
// never part of an id, so they are stripped before validation.
const SUFFIX_RE = /\/(full|thumb)\/?$/i

/**
 * Parse a request URI into a canonical media reference.
 * @param {string} uri raw CloudFront request.uri (case preserved, query string absent)
 * @returns {{kind: 'photos'|'videos'|null, id: string, valid: boolean}}
 *          `id` is the lower-cased identifier; `valid` is false for anything that is
 *          not exactly /<photos|videos>/<uuid>, which callers must answer with 404.
 */
function parseMediaUri (uri = '') {
  const raw = String(uri)
  const match = raw.match(/^\/(photos|videos)\/(.+)$/)
  if (!match) return { kind: null, id: '', valid: false }

  const kind = match[1]
  const candidate = match[2]
    .replace(SUFFIX_RE, '') // /photos/<id>/full -> <id>
    .replace(/\/+$/, '') // /photos/<id>/ -> <id>
    .toLowerCase()

  return { kind, id: candidate, valid: UUID_RE.test(candidate) }
}

/**
 * True when the URI differs from its canonical form and should be 301'd.
 * A trailing slash is a different URL to Google, so it belongs here too: the canonical
 * spelling has none, and leaving the slash alone let both spellings index side by side.
 */
function needsCanonicalRedirect (uri = '') {
  const parsed = parseMediaUri(uri)
  if (!parsed.valid) return false
  // Equality is the whole test: `id` is already lower-cased and stripped of /full, so any
  // spelling that is not byte-identical to the canonical one differs in case or slashes.
  return String(uri) !== `/${parsed.kind}/${parsed.id}`
}

module.exports = { parseMediaUri, needsCanonicalRedirect, UUID_RE }
