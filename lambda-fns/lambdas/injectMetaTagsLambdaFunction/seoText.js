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
// Every slot that lists AI tags (page title head, og:image:title, meta description lead) uses the
// same first three, so one photo never shows Google two different lists.
const TAG_TITLE_LIMIT = 3
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

/**
 * The description carries whichever of the two texts the title did not use as its head. The title is
 * headed by the comment whenever there is one, so a photo with both a comment and tags shows the tag
 * list here - worded without "unaltered", which the brand sentence at the end of every description
 * already says. With only one of the two texts available there is nothing else to say, so title and
 * description may share it. Every slot that lists tags uses the same first three.
 */
function descriptionLead (caption, labels, kindLabel, leadBudget) {
  if (caption && labels.length) return truncate(`In this ${kindLabel}: ${labels.slice(0, TAG_TITLE_LIMIT).join(', ')}`, leadBudget)
  if (caption) return truncate(caption, leadBudget)
  if (labels.length) return truncate(`${labels.slice(0, TAG_TITLE_LIMIT).join(', ')} unaltered ${kindLabel}`, leadBudget)
  return ''
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
  // The title keeps the comment as its head whenever there is one: it is the only per-photo unique
  // sentence WiSaw has, and a comma list of tags truncates badly inside ~60 characters. See
  // descriptionLead() for where the other text goes instead.
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
  const head = subject || (labels.length ? labels.slice(0, TAG_TITLE_LIMIT).join(', ') : '')
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

  const lead = descriptionLead(caption, labels, kindLabel, leadBudget)

  // og:image:title and og:image:caption must not say the same thing. The title answers "what is
  // in this image" from the AI tags; the caption answers "what do people say about it" from the
  // newest comment. With no comment there is nothing to caption, so the tag is simply omitted
  // rather than repeating the tags under a second name.
  const imageTitle = truncate(labels.length ? labels.slice(0, TAG_TITLE_LIMIT).join(', ') : pageTitle, 100)
  const imageCaption = truncate(caption, 200)

  return {
    pageTitle,
    metaDescription: truncate([lead, tail].filter(Boolean).join('. '), DESC_MAX),
    caption,
    imageTitle,
    imageCaption,
    labels,
    location,
    created: clean(sidecar && sidecar.created),
    width: clean(sidecar && sidecar.width),
    height: clean(sidecar && sidecar.height),
    duration: clean(sidecar && sidecar.duration)
  }
}

module.exports = { buildSeoFields, truncate, monthYear, normaliseLabels }
