/* eslint-env node */
/* global module */

// Turns the per-photo SEO sidecar (written by generateSiteMap from Postgres) into the
// text a crawler can rank on. Before this existed every page was titled
// "wisaw photo <uuid>", which gave Google 21k machine-generated near-identical
// documents and no reason to rank any of them.
//
// Nothing here invents data: absent fields stay absent so structured data stops
// publishing fabricated upload dates, and the fallback keeps the id in the title so an
// un-enriched page is still unique rather than one of thousands sharing one title.

const KIND_LABEL = { photo: 'photo', video: 'video' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function clean (value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

function truncate (value, max) {
  const text = clean(value)
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1).trim()}…`
}

/** 'Sep 2025' for a title; '' when the date is unknown or obviously a placeholder. */
function monthYear (isoDate) {
  const iso = clean(isoDate)
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2015) return ''
  return `${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`
}

function normaliseLabels (labels, limit = 8) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(labels) ? labels : []) {
    const label = clean(raw)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
    if (out.length >= limit) break
  }
  return out
}

/**
 * @param {object} input
 * @param {object} [input.sidecar] parsed seo/<id>.json, or null when unavailable
 * @param {'photo'|'video'} input.entityLabel
 * @param {string} input.imageIdText canonical lower-cased id
 * @param {string} [input.lastModified] S3 LastModified of the media object (fallback date)
 */
function buildSeoFields (input = {}) {
  const { sidecar = null, entityLabel = 'photo', imageIdText = '', lastModified = '' } = input
  const kindLabel = KIND_LABEL[entityLabel] || entityLabel
  const caption = clean(sidecar && sidecar.caption)
  const subject = truncate(caption, 60)
  const labels = normaliseLabels(sidecar && sidecar.labels)
  const location = clean(sidecar && sidecar.location)
  const when = monthYear((sidecar && sidecar.created) || lastModified)

  // "Golden retriever on the beach — photo, Brooklyn, Sep 2025 · WiSaw"
  // The head is budgeted against what follows it: truncating the finished string instead
  // threw away the place and capture month, which are exactly the parts that make one of
  // 21k pages differ from the next.
  const TITLE_MAX = 68
  const HEAD_MIN = 24
  const head = subject || (labels.length ? labels.slice(0, 3).join(', ') : '')
  const contextBits = []
  if (location) contextBits.push(location)
  if (when) contextBits.push(when)
  const context = contextBits.join(', ')

  const bareSuffix = ` — ${kindLabel} · WiSaw`
  const richSuffix = context ? ` — ${kindLabel}, ${context} · WiSaw` : bareSuffix
  const suffix = richSuffix.length + HEAD_MIN <= TITLE_MAX ? richSuffix : bareSuffix

  const pageTitle = head
    ? `${truncate(head, TITLE_MAX - suffix.length)}${suffix}`
    : `wisaw ${kindLabel} ${imageIdText}`

  // Budget the caption against what must survive after it. Truncating the finished string
  // cut the place and capture month off every page that had a caption longer than ~40
  // characters, which is precisely the freshness signal this rewrite exists to publish.
  const DESC_MAX = 158
  const brand = `Free ${kindLabel} on WiSaw - unaltered, taken with a phone camera`
  const facts = []
  if (location) facts.push(`Taken in ${location}`)
  if (when) facts.push(`Captured ${when}`)
  const tail = [facts.join('. '), brand].filter(Boolean).join('. ')
  const leadBudget = Math.max(40, DESC_MAX - tail.length - 2)

  let lead = ''
  if (caption) lead = truncate(caption, leadBudget)
  else if (labels.length) lead = truncate(`${labels.slice(0, 4).join(', ')} unaltered ${kindLabel}`, leadBudget)

  return {
    pageTitle,
    metaDescription: truncate([lead, tail].filter(Boolean).join('. '), DESC_MAX),
    caption,
    labels,
    location,
    created: clean(sidecar && sidecar.created),
    width: clean(sidecar && sidecar.width),
    height: clean(sidecar && sidecar.height),
    duration: clean(sidecar && sidecar.duration)
  }
}

module.exports = { buildSeoFields, truncate, monthYear, normaliseLabels }
