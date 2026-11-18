/* eslint-env node */
/* global module, require */

// The edge's view of the SEO text rules, which all live in seoRules.js. This file only renders:
// when a record carries finished strings under `seo` (the writer put them there), they go out as
// they are; when it predates that key, the same functions the writer used derive them here. Either
// way the bytes match, which is what lets records be backfilled at leisure instead of in lockstep
// with a deploy - and it removes the second copy of the rules that used to make first byte and
// hydrated head disagree.
//
// Before these rules were written down, every page was titled "wisaw photo <uuid>", which gave
// Google 21k machine-generated near-identical documents and no reason to rank any of them.
const { KIND_LABEL, buildSeoFields: derive, truncateWords, monthYear, normaliseLabels } = require('./seoRules')

function storedText (value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback
}

/**
 * @param {object} input
 * @param {object} [input.sidecar] parsed <id>.json, or null when unavailable
 * @param {'photo'|'video'} input.entityLabel
 * @param {string} input.imageIdText canonical lower-cased id
 * @param {string} [input.lastModified] S3 LastModified of the media object (fallback date)
 */
function buildSeoFields (input = {}) {
  const fields = derive(input)
  const stored = input.sidecar == null ? null : input.sidecar.seo
  if (stored == null || typeof stored !== 'object') return fields

  // A record describes one media type. Serving a photo's title on a /videos/ URL would be worse
  // than deriving, so a mismatch falls back to the shared rules rather than wearing the wrong text.
  const kindLabel = KIND_LABEL[input.entityLabel] || input.entityLabel
  if (String(stored.kind ?? '') !== String(kindLabel)) return fields

  // Verbatim: the record already holds finished text, so re-truncating it here is how a page ends
  // up with two slightly different titles.
  return Object.assign({}, fields, {
    pageTitle: storedText(stored.title, fields.pageTitle),
    metaDescription: storedText(stored.description, fields.metaDescription),
    imageTitle: storedText(stored.imageTitle, fields.imageTitle),
    imageCaption: storedText(stored.imageCaption, fields.imageCaption)
  })
}

module.exports = { buildSeoFields, truncate: truncateWords, monthYear, normaliseLabels }
