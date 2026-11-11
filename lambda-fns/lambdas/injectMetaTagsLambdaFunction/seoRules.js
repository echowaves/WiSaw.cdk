/* eslint-env node */
/* global module, require */

// One set of SEO text rules for the whole product. Loaded by every surface that turns a photo row
// into crawler text:
//   - utilities/seoSidecar.ts      builds the per-media record and stores the finished strings
//   - lambdas/generateSiteMap      fills the sitemap's image/video slots
//   - scripts/publish-seo-sidecars.js  operator backfill, same records as the scheduled job
//   - injectMetaTagsLambdaFunction  renders the stored strings at the edge
// The SPA reads the same finished strings out of <id>.json over HTTPS.
//
// It lives inside injectMetaTagsLambdaFunction/ for the reason spelled out in mediaNaming.js: the
// edge functions deploy as a raw zip of this folder (Code.fromAsset, no bundler), so shared code
// has to physically sit here. Plain CommonJS with no dependencies is what lets all four load it.
//
// Different word budgets for different slots are deliberate - a page title and a Google Image
// title are not the same thing. Duplicated ALGORITHMS are not, which is why truncateWords,
// monthYear and the label de-dup exist exactly once. Nothing here invents data: absent fields stay
// absent so structured data stops publishing fabricated upload dates.

const KIND_LABEL = { photo: 'photo', video: 'video' }

// Page slots (Lambda@Edge / the app's head).
const TITLE_MAX = 68 // <title> and og:title, together with their suffix
const HEAD_MIN = 24 // below this a title head is too thin to carry the rich suffix
const SUBJECT_MAX = 60 // the comment as it appears in a title head
const DESC_MAX = 158 // meta description, SERP limit

// Google Image / sitemap slots.
const IMAGE_TITLE_MAX = 100
const IMAGE_CAPTION_MAX = 512
const OG_IMAGE_CAPTION_MAX = 200

// Every slot that lists AI tags (page title head, og:image:title, meta description lead) uses the
// same first three, so one photo never shows Google two different lists.
const TAG_TITLE_LIMIT = 3
const LABEL_LIMIT = 8 // labels kept in one record

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// The per-media record every writer publishes and the edge reads. Kept at 1 until a field is
// dropped or redefined; `seo` was added alongside it without a bump, because old readers ignore
// unknown keys and new readers fall back to deriving when it is absent.
const SIDECAR_VERSION = 1
// A comment longer than this is not SEO text any more; the slot truncates at word boundaries.
const RECORD_CAPTION_MAX = 200

// Key names that can only ever mean a coordinate. Free-text fields (caption, labels) are not
// scanned for them: someone writing "40.68, -73.97" in a comment must not lose their SEO text.
const PRECISE_KEYS = ['lat', 'lon', 'lng', 'latitude', 'longitude', 'coords', 'coordinates', 'gps', 'geopoint', 'point']

function clean (value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
}

// Word-boundary truncation: a cut mid-word is what makes a crawler show "Sunse…" where a human
// sees "Sunset…". Used by every slot on both stacks.
function truncateWords (value, max) {
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

// Case-insensitively de-duplicated label list. Accepts the strings a record stores and the raw
// Rekognition values a DB row carries, so no caller has to normalise first.
function normaliseLabels (labels, limit = LABEL_LIMIT) {
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

// Newest-first label list from one or more rows' Rekognition JSONB blobs.
function pickLabels (rows, limit = LABEL_LIMIT) {
  const all = []
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    for (const raw of Array.isArray(row?.labels) ? row.labels : []) all.push(raw)
  }
  return normaliseLabels(all, limit)
}

// High-level place text ("Brooklyn, New York"), built from the address columns only. It is never
// read from the "location" geography column - see isPreciseLocation below.
function locationText (row) {
  return [row?.locality, row?.district, row?.region]
    .map((part) => clean(part))
    .filter(Boolean)
    // "Brooklyn, New York" reads well; a repeated place name does not.
    .filter((part, i, all) => all.indexOf(part) === i)
    .join(', ')
}

/** True for anything that carries a position rather than a place name. */
function isPreciseLocation (value) {
  if (value == null) return false
  // A Sequelize/geography value arrives as an object ({latitude, longitude} or a Point).
  if (typeof value === 'object') return true
  const text = String(value).trim()
  if (text === '') return false
  return /POINT\s*\(/i.test(text) ||
    // WKB/EWKB hex as Postgres hands back for a geography column.
    /^0[01][0-9A-Fa-f]{16,}$/.test(text) ||
    // "40.6833, -73.9740" or "40.6833 -73.9740"
    /^-?\d{1,3}\.\d+\s*[,\s]\s*-?\d{1,3}\.\d+$/.test(text)
}

// Throws instead of publishing. A coordinate on ~21k public objects is not recoverable after the
// fact, so a writer that is unsure fails the photo rather than guessing - and a failed PUT only
// costs one photo its enriched title until the next run.
function assertNoPreciseLocation (body) {
  const badKey = Object.keys(body).find((key) => PRECISE_KEYS.includes(key.toLowerCase()))
  if (badKey != null) {
    throw new Error(`refusing to publish a sidecar with a coordinate field: ${badKey}`)
  }
  if (isPreciseLocation(body.location)) {
    throw new Error('refusing to publish a sidecar whose location is a coordinate, not a place name')
  }
}

// What a photo with no AI tags is titled instead of its comment: place and capture month, which is
// what makes one photo's title differ from the next. The id only carries the whole title when
// neither is known, because a 36-character UUID truncated into the tail of a long place name says
// nothing to a crawler either way.
function identityTitle (media, kind) {
  const facts = [locationText(media), monthYear(media?.createdAt)].filter((part) => part.length > 0)
  if (facts.length > 0) return `WiSaw ${kind} — ${facts.join(', ')}`
  return `WiSaw ${kind} ${clean(media?.id)}`
}

/**
 * Decides which text fills the two image slots a crawler reads (sitemap / Google Image Search). The
 * AI tags answer "what is in this picture" and go in the title; the newest comment answers "what do
 * people say about it" and captions it. One sentence never fills both slots: with no tags the title
 * falls back to place, capture month and id rather than the comment, so equality only happens when
 * there is no comment to caption with - a surface that repeats one text twice teaches Google nothing
 * new, which is how 21k pages ended up looking near-identical once before.
 *
 * Same tolerance as buildSeoSidecar: a row missing labels or a comment yields the fallback rather
 * than throwing.
 */
function splitImageText (media, kindLabel) {
  const tags = pickLabels([media], TAG_TITLE_LIMIT).join(', ')
  const kind = clean(kindLabel)
  const title = truncateWords(tags.length > 0 ? tags : identityTitle(media, kind.length > 0 ? kind : 'photo'), IMAGE_TITLE_MAX)
  const comment = clean(media?.lastComment)
  return { title, caption: (comment.length > 0 ? comment : title).slice(0, IMAGE_CAPTION_MAX) }
}

/**
 * The description carries whichever of the two texts the title did not use as its head. The title is
 * headed by the comment whenever there is one, so a photo with both a comment and tags shows the tag
 * list here - worded without "unaltered", which the brand sentence at the end of every description
 * already says. With only one of the two texts available there is nothing else to say, so title and
 * description may share it. Every slot that lists tags uses the same first three.
 */
function descriptionLead (caption, labels, kindLabel, leadBudget) {
  if (caption && labels.length) return truncateWords(`In this ${kindLabel}: ${labels.slice(0, TAG_TITLE_LIMIT).join(', ')}`, leadBudget)
  if (caption) return truncateWords(caption, leadBudget)
  if (labels.length) return truncateWords(`${labels.slice(0, TAG_TITLE_LIMIT).join(', ')} unaltered ${kindLabel}`, leadBudget)
  return ''
}

/**
 * The finished page strings, from the fields a record holds. This is the whole text contract: the
 * writer runs it over the record it is publishing and stores the result under `seo`, so the edge
 * and the app render these bytes instead of composing their own. A record without a stored `seo`
 * (written before this existed) goes through the same function, so old and new pages match.
 *
 * @param {object} input
 * @param {object} [input.sidecar] parsed <id>.json, or null when unavailable
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
  const subject = truncateWords(caption, SUBJECT_MAX)
  const labels = normaliseLabels(sidecar && sidecar.labels)
  const location = clean(sidecar && sidecar.location)
  const when = monthYear((sidecar && sidecar.created) || lastModified)

  // "Golden retriever on the beach — photo, Brooklyn, Sep 2025 · WiSaw"
  // The head is budgeted against what follows it: truncating the finished string instead
  // threw away the place and capture month, which are exactly the parts that make one of
  // 21k pages differ from the next.
  const head = subject || (labels.length ? labels.slice(0, TAG_TITLE_LIMIT).join(', ') : '')
  const contextBits = []
  if (location) contextBits.push(location)
  if (when) contextBits.push(when)
  const context = contextBits.join(', ')

  const bareSuffix = ` — ${kindLabel} · WiSaw`
  const richSuffix = context ? ` — ${kindLabel}, ${context} · WiSaw` : bareSuffix
  const suffix = richSuffix.length + HEAD_MIN <= TITLE_MAX ? richSuffix : bareSuffix

  const pageTitle = head
    ? `${truncateWords(head, TITLE_MAX - suffix.length)}${suffix}`
    : `wisaw ${kindLabel} ${imageIdText}`

  // Budget the caption against what must survive after it. Truncating the finished string
  // cut the place and capture month off every page that had a caption longer than ~40
  // characters, which is precisely the freshness signal this rewrite exists to publish.
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
  const imageTitle = truncateWords(labels.length ? labels.slice(0, TAG_TITLE_LIMIT).join(', ') : pageTitle, IMAGE_TITLE_MAX)
  const imageCaption = truncateWords(caption, OG_IMAGE_CAPTION_MAX)

  return {
    pageTitle,
    metaDescription: truncateWords([lead, tail].filter(Boolean).join('. '), DESC_MAX),
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

/**
 * The record itself: the raw fields plus the finished strings built from them. Every writer goes
 * through here - the scheduled sitemap job, the comment path's refresh, the operator backfill - so
 * a record published by one cannot differ from a record published by another. Tolerates partial
 * rows the way buildSeoFields does: no labels or no place yet yields empty fields rather than
 * throwing mid-batch.
 */
function buildSeoRecord (photo) {
  const createdMs = photo?.createdAt == null ? NaN : new Date(photo.createdAt).getTime()
  // Which media type this row is, decided the way the sitemap job decides it - one row, one kind.
  const kind = photo?.video ? 'video' : 'photo'
  const base = {
    v: SIDECAR_VERSION,
    caption: clean(photo?.lastComment).slice(0, RECORD_CAPTION_MAX),
    labels: pickLabels([photo]),
    // An unreadable createdAt yields an empty field rather than throwing mid-batch.
    created: Number.isFinite(createdMs) ? new Date(createdMs).toISOString() : '',
    location: locationText(photo),
    width: clean(photo?.width),
    height: clean(photo?.height)
  }
  assertNoPreciseLocation(base)

  // The strings are computed from the record's own fields, by the same function the edge runs when a
  // record predates them. Storing the result is what lets every surface render instead of re-derive;
  // computing it from `base` (not the raw row) is what makes an old record and a new one identical.
  const fields = buildSeoFields({ sidecar: base, entityLabel: kind, imageIdText: String(photo?.id ?? '').toLowerCase() })

  return Object.assign({}, base, {
    seo: {
      kind,
      title: fields.pageTitle,
      description: fields.metaDescription,
      imageTitle: fields.imageTitle,
      imageCaption: fields.imageCaption
    }
  })
}

module.exports = {
  SIDECAR_VERSION,
  RECORD_CAPTION_MAX,
  KIND_LABEL,
  TITLE_MAX,
  HEAD_MIN,
  SUBJECT_MAX,
  DESC_MAX,
  IMAGE_TITLE_MAX,
  IMAGE_CAPTION_MAX,
  OG_IMAGE_CAPTION_MAX,
  TAG_TITLE_LIMIT,
  LABEL_LIMIT,
  PRECISE_KEYS,
  clean,
  truncateWords,
  monthYear,
  normaliseLabels,
  pickLabels,
  locationText,
  isPreciseLocation,
  assertNoPreciseLocation,
  identityTitle,
  splitImageText,
  descriptionLead,
  buildSeoFields,
  buildSeoRecord
}
