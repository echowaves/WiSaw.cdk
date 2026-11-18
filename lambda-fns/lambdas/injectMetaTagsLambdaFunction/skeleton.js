/* eslint-env node */
/* global module */

// The detail page template — the one place its markup is authored.
//
// Lambda@Edge paints this into the #root mount point, and it is not a placeholder any more: it is
// the page a browser paints before a single byte of JavaScript has run, and the client
// (WiSaw.client src/utils/detailSkeleton.js) adopts these exact nodes instead of replacing them.
// That adoption is what removes the LCP/CLS failure this replaces — React used to unmount the
// painted media at hydration, which re-dated the LCP paint to JS delivery time and shifted the
// layout under the user.
//
// The same module now also answers for every detail render the edge did not paint: prev/next
// navigation, local development and a stale-edge cache all reach a browser with no static frame,
// and the app used to answer those with its own older template — two looks for one page, and two
// files to change. So scripts/publish-detail-template.js renders this file into a committed ES
// module inside WiSaw.client (src/utils/detailTemplate.generated.js), which paints it from a
// string and portals its enhancements into the same slots. WiSaw.cdk/tests/
// detail-template-copy-once.js fails when that copy goes stale, and tests/edge-detail-skeleton.js
// pins the served bytes; both sides render this markup or a test says so.
//
// Adoption is strict, so these attributes are a wire contract shared with the client repo and
// pinned by tests on both sides: [data-wisaw-media] carries data-wisaw-id equal to the route id
// (lower case) plus numeric width/height; both slot divs must exist; and the media node's parent
// must be a positioned box, never the mount point itself — the interactive overlays portal into
// that box, so it needs position: relative.
//
// Geometry is authored here and read by the app (WiSaw.client src/utils/detailLayout.js re-exports
// these numbers rather than keeping its own): 700 px long side above the 700 px breakpoint,
// viewport-40 below it, a 72 px header band (64 px at <=768px) and 220 px reserved under the fold.
// The edge cannot know the viewport, so the two widths live in CSS and only the orientation-dependent
// cap is inline.

const DETAIL_MAX_SIDE = 700
// What a page falls back to when its record carries no width/height to lay out from — both the edge
// body and the app's own paint (mediaBoxStyle with unknown dimensions). Reserving the full 700 px
// cap for such a page painted a box bigger than the one then rendered, so the pre-hydration paint
// jumped when the client declined to adopt it.
const DETAIL_UNKNOWN_DIMENSION_CAP_PX = 300
const DETAIL_MOBILE_BREAKPOINT = 700
const HEADER_DESKTOP_PX = 72
const HEADER_MOBILE_PX = 64
const BELOW_MEDIA_RESERVE_PX = 220
const MEDIA_RADIUS_PX = 18

// Scoped by the template's own class names: the deployed app's stylesheet is already linked when
// this markup paints, so nothing here may rely on — or collide with — a class the app owns. The
// `wsk-` prefix exists for that reason, and it is what lets one string style the frame in either
// host (#root on the edge page, #wisaw-app once React paints it) without an ancestor prefix that
// would only match one of them. Descendant selectors only, no child combinators, and no `<` or `>`
// characters: this block lives inside the crawler body the mount-point scanner walks.
const SKELETON_STYLE = '<style>' +
  '.wsk{display:block}' +
  '.wsk-main{max-width:1100px;margin:0 auto;padding:20px 20px 28px}' +
  '.wsk-slot-header{min-height:' + HEADER_DESKTOP_PX + 'px}' +
  '.wsk-slot-below{min-height:' + BELOW_MEDIA_RESERVE_PX + 'px}' +
  '.wsk-box{position:relative;margin:16px auto;width:calc(100vw - 40px);max-width:100%;' +
  'overflow:hidden;border-radius:' + MEDIA_RADIUS_PX + 'px;background:var(--bg-raised,#f4f4f5)}' +
  '.wsk-media{display:block;width:100%;height:100%;object-fit:contain;' +
  'border-radius:' + MEDIA_RADIUS_PX + 'px}' +
  '.wsk-box--broken .wsk-media{visibility:hidden}' +
  '@media screen and (min-width:' + DETAIL_MOBILE_BREAKPOINT + 'px){' +
  '.wsk-box{width:var(--wsk-cap,' + DETAIL_MAX_SIDE + 'px)}}' +
  '@media screen and (max-width:768px){.wsk-slot-header{min-height:' + HEADER_MOBILE_PX + 'px}}' +
  '</style>'

// Hides the media box's picture when the object is gone, leaving the reserved geometry in place:
// a failed fetch must not shift the page. Script-local, never throws, no dependency on the bundle.
const MEDIA_ONERROR = "this.parentNode&amp;&amp;(this.parentNode.className+=' wsk-box--broken')"

// Attribute escaping for the markup this module builds. It lives here rather than in utils.js
// because everything that writes an attribute value into the frame — including the media element
// below — is now written here; utils.js imports it from this file, so there is still one escaper.
const escapeHtmlAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// A size is a size only if it is a positive whole number of pixels. Records come out of Postgres
// as text, and an extraction that failed stored '0' or '' — both of which used to reach the page
// as width="0", a fact about the file that is not true and that the client declines to lay out
// from anyway (its adoption guard wants numeric width/height).
function positiveInt (value) {
  const text = String(value == null ? '' : value).trim()
  if (!/^\d+$/.test(text)) return null
  const parsed = Number(text)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Inline geometry for the media box. When the record has no usable dimensions the box keeps a
 * square aspect ratio at the app's own unknown-size cap instead of an auto height, which is what
 * shifts.
 */
function mediaBoxStyle (width, height) {
  const w = positiveInt(width)
  const h = positiveInt(height)
  if (w === null || h === null) return 'aspect-ratio:1/1;--wsk-cap:' + DETAIL_UNKNOWN_DIMENSION_CAP_PX + 'px'
  // The client caps the long side at 700 px, so a portrait media element is displayed narrower.
  const cap = w > h ? DETAIL_MAX_SIDE : Math.round(DETAIL_MAX_SIDE * w / h)
  return 'aspect-ratio:' + w + '/' + h + ';--wsk-cap:' + cap + 'px'
}

// The one media element the browser paints first, with the attributes the client's adoption check
// reads (data-wisaw-media, data-wisaw-id, numeric width/height). A photo keeps the full-resolution
// object: the edge cannot know the viewport, and the shell's preload/swap scripts already demote it
// to the thumb below the breakpoint. A video wears the thumbnail as its poster instead — that
// paint is its LCP candidate, and the full-size derivative it used to point at cost 20 s on a
// throttled phone. The full-res object still exists for crawlers in JSON-LD contentUrl.
function mediaElement (options = {}) {
  const { entityLabel = '', imageUrl = '', previewUrl = '', videoUrl = '', altText = '', mediaId = '', width = '', height = '' } = options
  // No dimensions means no honest box: the client declines to adopt a page whose media has no
  // numeric size, and renders that route itself rather than guessing. A record whose extraction
  // failed stores '0', which is truthy as text — publishing width="0" would be both a lie about
  // the file and a page the client then refuses to adopt, so only positive whole pixels count.
  const boxWidth = positiveInt(width)
  const boxHeight = positiveInt(height)
  const dims = (boxWidth && boxHeight) ? ` width="${boxWidth}" height="${boxHeight}"` : ''
  // The object URLs are published, not left to be rebuilt from the id: WiSaw.client seeds its first
  // commit from these, so the naming rule stays written once per side and a rename in mediaNaming.js
  // cannot leave a seeded paint pointing at an object that was never written. `data-wisaw-src` is the
  // image this page may safely paint: the full-resolution derivative on a photo, the thumbnail on a
  // video, where the rules below keep the multi-megabyte object off the page entirely; a video's own
  // file is already its `src`. `data-wisaw-thumb` is the same file og:image names. Both are always
  // present so the client has one contract instead of a per-kind one.
  const publishedSrc = entityLabel === 'video' ? previewUrl : imageUrl
  const publishedUrls = ` data-wisaw-src="${escapeHtmlAttribute(publishedSrc)}" data-wisaw-thumb="${escapeHtmlAttribute(previewUrl)}"`
  const adoption = ` data-wisaw-media data-wisaw-id="${escapeHtmlAttribute(mediaId)}" class="wsk-media" onerror="${MEDIA_ONERROR}"${publishedUrls}`
  if (entityLabel === 'video') {
    // playsinline belongs on the first paint too, not only on the element React renders after
    // adoption: without it iOS Safari takes a tapped video full-screen instead of playing it in
    // the box the page was laid out around.
    return `<video controls playsinline preload="none"${adoption} poster="${escapeHtmlAttribute(previewUrl)}"${dims} src="${escapeHtmlAttribute(videoUrl)}"></video>`
  }
  return `<img${adoption} src="${escapeHtmlAttribute(imageUrl)}" alt="${escapeHtmlAttribute(altText)}"${dims} loading="eager">`
}

/** The enhancement slots React portals into: header band above, comments/footer below. */
function slot (name) {
  return '<div class="wsk-slot-' + name + '" data-wisaw-slot="' + name + '"></div>'
}

/**
 * Wraps the already-escaped media element in its fixed box and lays out the page around it.
 * `mediaHtml` arrives escaped by utils.js — this module never receives raw record text.
 */
function renderSkeleton (parts = {}) {
  const { mediaHtml = '', boxStyle = '', title = '', descriptionHtml = '', labelLinksHtml = '', navHtml = '' } = parts
  return '<div class="wsk">' +
    slot('header') +
    '<div class="wsk-main">' +
    '<div class="wsk-box" style="' + boxStyle + '">' + mediaHtml + '</div>' +
    '<h1>' + title + '</h1>' +
    descriptionHtml +
    labelLinksHtml +
    navHtml +
    slot('below') +
    '</div>' +
    '</div>'
}

// Text-node escaping: same characters as the attribute escaper minus the quotes, matching what the
// body builder has always emitted so a refactor cannot quietly change an indexed page's bytes.
function escapeHtmlText (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Labels shown as tag links under the media. The limit is the same eight the record carries
// (seoRules.LABEL_LIMIT); naming it here rather than importing keeps this module dependency-free,
// which is what lets the app render it at all.
const FRAME_LABEL_LIMIT = 8

/** The description paragraph. Always one paragraph, even when empty, so both hosts lay out alike. */
// What a page says under the heading before any wording has been published for it. Both edge
// handlers read these from here, and so does the app — this module is published into WiSaw.client —
// because a page painted there used to have no sentence at all where the served page had one.
const FALLBACK_DESCRIPTIONS = {
  photo: 'Free unaltered photo on WiSaw - authentic photos and videos taken with phone cameras.',
  video: 'Free unaltered video on WiSaw - authentic photos and videos taken with phone cameras.'
}

function descriptionMarkup (description) {
  return '<p>' + escapeHtmlText(description) + '</p>'
}

/** Up to eight recognition labels as search links, or nothing at all when there are none. */
function labelLinksMarkup (labels) {
  const links = (Array.isArray(labels) ? labels : [])
    .slice(0, FRAME_LABEL_LIMIT)
    .map((label) => `<a rel="tag" href="/search/${escapeHtmlAttribute(encodeURIComponent(label))}">${escapeHtmlText(label)}</a>`)
    .join(' ')
  return links ? `<p>${links}</p>` : ''
}

/** The one link the frame carries for a reader who arrived on a media page and wants the site. */
function homeNavHtml () {
  return '<nav><a href="/">WiSaw - free authentic stock photos and videos</a></nav>'
}

// What the picture is alt-texted as: what a person said about it, else what the tags say, else what
// the page says about it, else the page title. Both hosts need the same answer or the same photo is
// described two different ways depending on how the visitor got there.
function altTextFor (parts = {}) {
  const { caption = '', labels = [], description = '', title = '' } = parts
  return caption || (Array.isArray(labels) ? labels.join(', ') : '') || description || title
}

/**
 * The whole visible page for one media record, as one string: the scoped stylesheet plus the frame
 * around its media element, heading, description, tag links and home link.
 *
 * This is the function both sides call. Lambda@Edge prepends nothing and appends its structured-data
 * graphs; WiSaw.client paints it verbatim for a detail render the edge did not paint (prev/next,
 * local development, a stale edge cache) and portals its enhancements into the slots. Same inputs,
 * same bytes — that is the whole point of this module, and tests/detail-template-copy-once.js pins
 * the served output against stored fixtures.
 */
function detailFrameHtml (parts = {}) {
  const {
    entityLabel = 'photo',
    imageUrl = '',
    previewUrl = '',
    videoUrl = '',
    altText = '',
    mediaId = '',
    width = '',
    height = '',
    title = '',
    description = '',
    labels = [],
    withStyle = true
  } = parts
  const frame = renderSkeleton({
    mediaHtml: mediaElement({ entityLabel, imageUrl, previewUrl, videoUrl, altText, mediaId, width, height }),
    boxStyle: mediaBoxStyle(width, height),
    title: escapeHtmlText(title),
    descriptionHtml: descriptionMarkup(description),
    labelLinksHtml: labelLinksMarkup(labels),
    navHtml: homeNavHtml()
  })
  return withStyle ? SKELETON_STYLE + frame : frame
}

/** Breadcrumb graph for a detail page. The client stops publishing head data, so the edge owns it. */
function breadcrumbGraph (parts = {}) {
  const { title = '', pageUrl = '' } = parts
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://wisaw.com/' },
      { '@type': 'ListItem', position: 2, name: title, item: pageUrl }
    ]
  }
}

module.exports = {
  DETAIL_MAX_SIDE,
  DETAIL_UNKNOWN_DIMENSION_CAP_PX,
  DETAIL_MOBILE_BREAKPOINT,
  BELOW_MEDIA_RESERVE_PX,
  HEADER_DESKTOP_PX,
  HEADER_MOBILE_PX,
  MEDIA_RADIUS_PX,
  SKELETON_STYLE,
  MEDIA_ONERROR,
  FALLBACK_DESCRIPTIONS,
  escapeHtmlAttribute,
  positiveInt,
  mediaBoxStyle,
  mediaElement,
  renderSkeleton,
  descriptionMarkup,
  labelLinksMarkup,
  homeNavHtml,
  altTextFor,
  detailFrameHtml,
  breadcrumbGraph
}
