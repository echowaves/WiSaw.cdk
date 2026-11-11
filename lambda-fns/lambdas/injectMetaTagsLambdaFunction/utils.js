/* eslint-env node */
/* global module, require */
const { imageObjectKey, thumbnailObjectKey, imgUrl } = require('./mediaNaming')
const { durationSeconds, iso8601Duration } = require('./seoRules')
const escapeHtmlAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

// Head values the browser app renders too. They are named here because a crawler that runs
// JavaScript and one that doesn't must not disagree about them; scripts/publish-static-seo.js
// generates src/utils/staticSeo.generated.js from this table, and seoDefaults.js re-exports it,
// so there is no second copy left to drift.
const SITE_NAME = 'WiSaw'
// Owned by the edge like site name and robots: stripped from whatever the template carried and
// re-emitted with data-rh, which only works because every route in the app declares it too.
const LOCALE = 'en_US'
const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
// Same vocabulary as the X-Robots-Tag header: a page whose header excludes it while its
// body invites indexing gets crawled by whichever signal a crawler trusts more.
const ROBOTS_NOINDEX = 'noindex, follow'
const TWITTER_CARD = 'summary_large_image'

// One place decides what a media item's preview image is: the thumbnail, which is also what
// the app publishes and what the sitemap lists as thumbnail_loc.
const thumbUrl = (imageId = '') => imgUrl(thumbnailObjectKey(imageId))

const normalizeImageId = (uri = '') =>
  String(uri)
    .replace('/photos/', '')
    .replace('/videos/', '')
    .replace('/full', '')
    .replace('/thumb', '')
    .replace(/\//g, '')

function sanitizeImageId (uri = '') {
  const normalized = normalizeImageId(uri)
  return {
    raw: normalized,
    text: escapeHtmlAttribute(normalized),
    url: escapeHtmlAttribute(encodeURIComponent(normalized))
  }
}

function stripExistingMetaTags (html = '') {
  return html
    .replace(/<meta\s[^>]*property=["']og:(image|title|url|type|description)["'][^>]*\/?>\s*/gi, '')
    // The og:image:title / og:image:caption pair is ours to own; the pattern above deliberately
    // does not match them (it requires the closing quote after "og:image"), so strip them here.
    .replace(/<meta\s[^>]*property=["']og:image:(title|caption)["'][^>]*\/?>\s*/gi, '')
    .replace(/<meta\s[^>]*name=["']twitter:(card|title|image|description)["'][^>]*\/?>\s*/gi, '')
    // The shipped template carries one tag with both name="description" and
    // property="og:description". Attribute order must not matter: the old pattern
    // required name= before property= and would leave a reversed tag behind, which
    // becomes a second description once the injector adds its own.
    .replace(/<meta\s(?=[^>]*\bname=["']description["'])[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s(?=[^>]*\bproperty=["']og:description["'])[^>]*\/?>\s*/gi, '')
    // og:site_name and robots are also ours to own. Without stripping them the injected copy
    // sits next to the template's, and a crawler sees two values for one property - which is
    // what happened while these tags had no data-rh and the browser app never reconciled them.
    .replace(/<meta\s(?=[^>]*\bproperty=["']og:site_name["'])[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s(?=[^>]*\bproperty=["']og:locale["'])[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s(?=[^>]*\bname=["']robots["'])[^>]*\/?>\s*/gi, '')
}

// Google reads <meta name="description"> for snippets; og:description is not a
// substitute, and the deep pages shipped without one until now.
function renderDescriptionTags (description = '') {
  const safe = escapeHtmlAttribute(description)
  if (!safe) return ''
  return '      <meta name="description" content="' + safe + '" data-rh="true">\n'
}

// Served instead of the app shell when an id is absent or malformed. Deliberately
// tiny and never fetched from S3: a crawler hitting a dead id should get a real 404
// with noindex, not the SPA (soft 404) and not another origin read.
function renderNotFoundDocument (entityLabel = 'photo') {
  const label = escapeHtmlAttribute(entityLabel)
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<title>This ' + label + ' no longer exists | WiSaw</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, follow">' +
    '<link rel="canonical" href="https://wisaw.com/">' +
    '</head><body><main><h1>This ' + label + ' no longer exists</h1>' +
    '<p>It was removed or never existed. Browse current photos and videos instead.</p>' +
    '<p><a href="/">WiSaw - free authentic stock photos and videos</a></p>' +
    '</main></body></html>'
}

// Elements whose contents are text, not markup. A `</div>` written inside one of them - or inside
// an HTML comment - is characters, not structure, and must never end the mount point.
const RAW_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea'])

// What may follow a '<' for it to be markup at all: a tag name, a closing slash, a comment or a
// processing instruction. Everything else is text.
const TAG_START_CHAR = /[a-zA-Z/?!]/

// Attribute test applied to an open tag's own text, so `data-id="root"` and `id="rooting"`
// cannot be mistaken for the mount point.
const ROOT_ID_ATTR = /(?:^|\s)id\s*=\s*['"]?root['"]?(?=[\s/>])/i

// Markup whose loss means the browser cannot boot the app; compared before/after injection.
const BOOT_CRITICAL_PATTERNS = [
  /<script\b[^>]*\btype=["']module["']/gi,
  /<link\b[^>]*\brel=["']stylesheet["']/gi,
  /<script\b/gi
]

function countMatches (text, pattern) {
  return (text.match(pattern) || []).length
}

// Index just past the '>' that closes the tag starting at `lt`, honouring quoted attribute
// values so a '>' inside an attribute cannot truncate the tag.
function endOfTag (html, lt) {
  let i = lt + 1
  let quote = ''
  while (i < html.length) {
    const ch = html[i]
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '>') {
      return i + 1
    }
    i++
  }
  return html.length
}

function tagNameOf (tagText) {
  const match = /^<\s*\/?\s*([a-zA-Z][^\s/>]*)/.exec(tagText)
  return match ? match[1].toLowerCase() : ''
}

// Index of the `</name` that ends a raw-text element's content, or -1 when it is never closed.
function indexOfCloseTag (html, from, name) {
  let i = from
  while ((i = html.indexOf('</', i)) !== -1) {
    const next = html[i + 2 + name.length] || '>'
    if (html.slice(i + 2, i + 2 + name.length).toLowerCase() === name && /[\s/>]/.test(next)) return i
    i += 2
  }
  return -1
}

function blankRange (chars, from, to) {
  const end = Math.min(to, chars.length)
  for (let i = from; i < end; i++) chars[i] = ' '
}

function skipMaskedComment (html, chars, lt) {
  const found = html.indexOf('-->', lt)
  const to = found === -1 ? html.length : found + 3
  blankRange(chars, lt, to)
  return to
}

// Blanks the content of a raw-text element, including its closing tag, and returns where
// structural scanning resumes.
function maskRawTextThrough (html, chars, contentStart, name) {
  const close = indexOfCloseTag(html, contentStart, name)
  if (close === -1) {
    blankRange(chars, contentStart, html.length)
    return html.length
  }
  const tagEnd = endOfTag(html, close)
  blankRange(chars, contentStart, tagEnd)
  return tagEnd
}

// Returns a copy of `html` with comments and raw-text contents replaced by spaces. One space per
// removed character keeps every index aligned with the original, so positions found here can be
// used to cut the real document. The old /(<div id="root">)[\s\S]*?(<\/div>)/i regex had no such
// protection: a `</div>` in a comment or a `<div id="root">` inside inline JS moved the cut, and
// the page went out with its body swallowed.
function maskNonStructural (html) {
  const chars = html.split('')
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) break
    if (html.startsWith('<!--', lt)) {
      i = skipMaskedComment(html, chars, lt)
      continue
    }
    // A bare `<` in text (`a < b`, `100 < 50%`) is not markup. Reading it as a tag start swallows
    // the following real tag into one bogus tag and resumes the scan inside raw-text content,
    // which would hand the depth counter a `</div>` living in a JS string again.
    if (!TAG_START_CHAR.test(html.charAt(lt + 1))) {
      i = lt + 1
      continue
    }
    const tagEnd = endOfTag(html, lt)
    const name = tagNameOf(html.slice(lt, tagEnd))
    if (!RAW_TEXT_ELEMENTS.has(name) || html[lt + 1] === '/') {
      i = tagEnd
      continue
    }
    i = maskRawTextThrough(html, chars, tagEnd, name)
  }
  return chars.join('')
}

// Index just past the document's one real <div id="root"> open tag; null when there is none or
// more than one. An ambiguous mount point is never guessed at.
function findRootOpenEnd (masked) {
  const pattern = /<div\b[^>]*>/gi
  let found = -1
  let count = 0
  let match
  while ((match = pattern.exec(masked)) !== null) {
    if (!ROOT_ID_ATTR.test(match[0])) continue
    count++
    found = match.index + match[0].length
  }
  return count === 1 ? found : null
}

// Index of the </div> belonging to the mount point itself, by counting nested <div> depth so a
// child div's close can never stand in for it. -1 when the mount point is never closed.
function findRootCloseStart (masked, from) {
  const pattern = /<\/?div\b[^>]*>/gi
  pattern.lastIndex = from
  let depth = 1
  let match
  while ((match = pattern.exec(masked)) !== null) {
    if (match[0][1] === '/') {
      depth--
      if (depth === 0) return match.index
    } else {
      depth++
    }
  }
  return -1
}

// The crawler body is allowed to add markup (it always carries its own JSON-LD script); it is not
// allowed to lose any of the shell's. A drop in count means the cut swallowed something.
function dropsBootCriticalMarkup (source, injected) {
  return BOOT_CRITICAL_PATTERNS.some((pattern) => countMatches(injected, pattern) < countMatches(source, pattern))
}

// Every failure here returns the untouched document: a page that keeps yesterday's placeholder
// body still boots and still holds its indexable head, while a mis-cut one is blank.
function rootBodyFailSafe (html, why) {
  console.error('renderRootBody skipped:', why, '- serving shell unchanged')
  return html
}

// Replaces the contents of the static <div id="root"> shell with crawler-visible
// markup. React hydration replaces this subtree with the live app; it exists so a
// fetch without JavaScript still yields a title, an image with alt text, real links,
// and structured data. Locating the mount point is structural (comments and script
// contents ignored, nesting depth counted) and every doubtful case leaves the input
// byte-for-byte unchanged.
function renderRootBody (html = '', bodyHtml = '') {
  if (!bodyHtml || typeof html !== 'string') return html
  const masked = maskNonStructural(html)
  const openEnd = findRootOpenEnd(masked)
  if (openEnd === null) return rootBodyFailSafe(html, 'document has no single <div id="root"> mount point')
  const closeStart = findRootCloseStart(masked, openEnd)
  if (closeStart === -1) return rootBodyFailSafe(html, '<div id="root"> has no matching </div>')
  const injected = html.slice(0, openEnd) + bodyHtml + html.slice(closeStart)
  if (findRootOpenEnd(maskNonStructural(injected)) === null) return rootBodyFailSafe(html, 'result does not have exactly one mount point')
  if (dropsBootCriticalMarkup(html, injected)) return rootBodyFailSafe(html, 'result lost boot-critical markup')
  return injected
}

// Crawler-visible body markup for photo/video pages: heading with the real title, the
// media itself with alt text, a description paragraph, a small link graph (home, image,
// entity label searches), and schema.org structured data. This is what lets the page be
// indexed and appear in Google Image/Video search without executing JavaScript.
function buildSeoBody (options = {}) {
  const {
    entityLabel = 'photo',
    pathSegment = '',
    imageIdText = '',
    pageTitle = '',
    description = '',
    caption = '',
    labels = [],
    videoUrl = '',
    created = '',
    duration = null,
    width = '',
    height = ''
  } = options

  const escText = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const escAttr = escapeHtmlAttribute
  // Escaping < and > keeps user content (captions, labels) from closing the surrounding
  // <script> element: JSON strings stay valid because these are escapes inside them.
  const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

  const title = pageTitle || `wisaw ${entityLabel} ${imageIdText}`
  const pageUrl = `https://wisaw.com/${pathSegment}/${encodeURIComponent(imageIdText)}`
  const imageUrl = imgUrl(imageObjectKey(encodeURIComponent(imageIdText)))
  // The preview image everywhere else is the thumbnail; structured data must not name a
  // different file as this page's picture. contentUrl keeps the full derivative.
  const previewUrl = thumbUrl(encodeURIComponent(imageIdText))
  const altText = caption || labels.join(', ') || description || title

  const labelLinks = labels
    .slice(0, 8)
    .map((label) => `<a rel="tag" href="/search/${escAttr(encodeURIComponent(label))}">${escText(label)}</a>`)
    .join(' ')

  let media
  if (entityLabel === 'video') {
    const poster = ` poster="${escAttr(imageUrl)}"`
    const dims = (width && height) ? ` width="${escAttr(width)}" height="${escAttr(height)}"` : ''
    media = `<video controls preload="none"${poster}${dims} src="${escAttr(videoUrl)}"></video>`
  } else {
    const dims = (width && height) ? ` width="${escAttr(width)}" height="${escAttr(height)}"` : ''
    media = `<img src="${escAttr(imageUrl)}" alt="${escAttr(altText)}"${dims} loading="eager">`
  }

  const jsonLd = entityLabel === 'video'
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: title,
        description: description || title,
        thumbnailUrl: previewUrl,
        uploadDate: created || undefined,
        contentUrl: videoUrl || undefined,
        embedUrl: pageUrl,
        // ISO 8601 is the form VideoObject requires; an unmeasured video publishes nothing.
        duration: iso8601Duration(duration) || undefined,
        creator: { '@type': 'Organization', name: 'WiSaw' }
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Photograph',
        name: title,
        caption: caption || undefined,
        contentUrl: imageUrl,
        license: 'https://wisaw.com/terms',
        creditText: 'WiSaw',
        creator: { '@type': 'Organization', name: 'WiSaw', url: 'https://wisaw.com' },
        url: pageUrl
      }

  return (
    `<h1>${escText(title)}</h1>` +
    media +
    `<p>${escText(description)}</p>` +
    (labelLinks ? `<p>${labelLinks}</p>` : '') +
    '<nav><a href="/">WiSaw - free authentic stock photos and videos</a></nav>' +
    `<script type="application/ld+json">${safeJson(jsonLd)}</script>`
  )
}

function injectMetaTags (html = '', options = {}) {
  const {
    description = '',
    metaDescription = '',
    entityLabel = '',
    ogType = '',
    pathSegment = '',
    imageIdText = '',
    imageIdUrl = '',
    pageTitle = '',
    videoUrl = '',
    videoDuration = null,
    imageTitle = '',
    imageCaption = '',
    bodyHtml = ''
  } = options

  const safeDescription = escapeHtmlAttribute(description)
  const safeEntityLabel = escapeHtmlAttribute(entityLabel)
  const safeOgType = escapeHtmlAttribute(ogType)
  const safePathSegment = escapeHtmlAttribute(pathSegment)
  const safeImageIdUrl = escapeHtmlAttribute(imageIdUrl)
  const safeImageIdText = escapeHtmlAttribute(imageIdText)
  const safePageTitle = pageTitle
    ? escapeHtmlAttribute(pageTitle)
    : `wisaw ${safeEntityLabel} ${safeImageIdText}`

  // Google's image rich results read og:image:title and og:image:caption. They must carry
  // different information — the AI tags in the title, the newest comment in the caption — so an
  // absent caption drops its tag instead of echoing the tags back under another name.
  const safeImageTitle = imageTitle ? escapeHtmlAttribute(imageTitle) : ''
  const safeImageCaption = imageCaption ? escapeHtmlAttribute(imageCaption) : ''
  const imageMetaTags =
    (safeImageTitle ? '      <meta property="og:image:title" content="' + safeImageTitle + '" data-rh="true">\n' : '') +
    (safeImageCaption ? '      <meta property="og:image:caption" content="' + safeImageCaption + '" data-rh="true">\n' : '')

  // Canonicalisation defence: ids are stored lower-cased, so an uppercase request URL
  // must not become its own canonical target. Without this, /photos/35E9... and
  // /photos/35e9... each claim to be the original.
  const canonicalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageIdUrl)
    ? imageIdUrl.toLowerCase()
    : imageIdUrl
  const safeCanonicalId = escapeHtmlAttribute(canonicalId)

  let updatedHtml = stripExistingMetaTags(html)
  updatedHtml = updatedHtml.replace(
    /<title>.*?<\/title>/i,
    '<title>' + safePageTitle + '</title>'
  )

  let metaTags = '</title>\n' +
      renderDescriptionTags(metaDescription || description) +
      '      <meta name="robots" content="' + ROBOTS_INDEX + '" data-rh="true">\n' +
      // The preview image is the thumbnail, the same file the app publishes and the sitemap
      // lists. Pointing here at the full-size derivative made three surfaces disagree about
      // what a page's picture is.
      '      <meta property="og:image" content="' + thumbUrl(safeImageIdUrl) + '" data-rh="true">\n' +
      imageMetaTags +
      '      <meta property="og:description" content="' + safeDescription + '" data-rh="true">\n' +
      '      <meta property="og:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta property="og:url" content="https://wisaw.com/' + safePathSegment + '/' + safeCanonicalId + '" data-rh="true">\n' +
      '      <meta property="og:site_name" content="' + SITE_NAME + '" data-rh="true">\n' +
      '      <meta property="og:locale" content="' + LOCALE + '" data-rh="true">\n' +
      '      <meta property=\'og:type\' content=\'' + safeOgType + '\' data-rh="true"/>\n' +
      '      <meta name="twitter:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta name="twitter:card" content="' + TWITTER_CARD + '" data-rh="true">\n' +
      '      <meta name="twitter:image" content="' + thumbUrl(safeImageIdUrl) + '" data-rh="true">\n'

  if (videoUrl) {
    const safeVideoUrl = escapeHtmlAttribute(videoUrl)
    metaTags += '      <meta property="og:video" content="' + safeVideoUrl + '" data-rh="true">\n'
    // Open Graph wants whole seconds here while the JSON-LD below wants ISO 8601; both come from the
    // same stored number, and neither is written when nobody has measured this video.
    const seconds = durationSeconds(videoDuration)
    if (seconds != null) {
      metaTags += '      <meta property="og:video:duration" content="' + seconds + '" data-rh="true">\n'
    }
  }

  const canonicalUrl = 'https://wisaw.com/' + safePathSegment + '/' + safeCanonicalId

  // Byte-tolerant canonical rewrite. The previous code replaced one exact literal
  // (`<link rel="canonical" href="https://wisaw.com" data-rh="true"/>`), which did not
  // match the deployed template (`rel='canonical'` with single quotes and a space before
  // `/>`). The miss was silent: every photo/video URL kept pointing its canonical at the
  // homepage, so Google treated ~22k pages as duplicates of wisaw.com/ and dropped them.
  const canonicalTag = '<link rel="canonical" href="' + canonicalUrl + '" data-rh="true">'
  const canonicalPattern = /<link\b[^>]*\brel=(?:"canonical"|'canonical')[^>]*>/i
  let withCanonical = updatedHtml.replace(canonicalPattern, canonicalTag)
  if (!canonicalPattern.test(withCanonical)) {
    // Template without any canonical (newer index.html ships none): inject ours so the
    // signal is explicit rather than relying on the implicit self-reference. Kept free
    // of '</title>' because the meta-tag insertion below anchors on that token.
    withCanonical = withCanonical.replace(/<title>[^<]*<\/title>/i, function (m) { return m + '\n      ' + canonicalTag })
  }

  let finalHtml = withCanonical.replace(
    '</title>',
    metaTags
  )

  if (bodyHtml) {
    finalHtml = renderRootBody(finalHtml, bodyHtml)
  }

  return finalHtml
}

// One place to build the CloudFront response so every edge route shares cache TTLs and
// so crawler directives can be set as headers too. X-Robots-Tag is the strongest signal
// available: it survives even when a page's HTML is later replaced by the SPA shell.
function htmlResponse (status, body, options = {}) {
  const { noindex = false, cacheControl = 'max-age=100' } = options
  const headers = {
    'cache-control': [{ key: 'Cache-Control', value: cacheControl }],
    'content-type': [{ key: 'Content-Type', value: 'text/html' }],
    'x-robots-tag': [
      { key: 'X-Robots-Tag', value: noindex ? 'noindex, follow' : 'index, follow' }
    ],
    'access-control-allow-origin': [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    'access-control-allow-methods': [{ key: 'Access-Control-Allow-Methods', value: 'GET, HEAD' }],
    'access-control-max-age': [{ key: 'Access-Control-Max-Age', value: '86400' }]
  }
  return {
    status: String(status),
    statusDescription: status === 404 ? 'Not Found' : 'OK',
    headers,
    body
  }
}

// Head rewrite for the non-media routes (/ , /about, /contact, /terms, /search).
// Those pages used to be served straight from S3: no canonical at all on the homepage,
// and every static route wearing the homepage title, which made them look like copies of
// wisaw.com/. Same escaping rules as the media injector. `image` is the brand picture for routes
// that have no per-page representative: the cleaner removes the template's og:image, so without
// this these pages reached crawlers with no image at all while browsers had the app's.
function injectRouteTags (html = '', options = {}) {
  const { title = '', description = '', canonical = '', image = '', noindex = false } = options

  let updatedHtml = stripExistingMetaTags(html)

  if (title) {
    const safeTitle = escapeHtmlAttribute(title)
    updatedHtml = updatedHtml.replace(/<title>.*?<\/title>/is, '<title>' + safeTitle + '</title>')
    updatedHtml = updatedHtml.replace(
      /<meta\s[^>]*property=["']og:title["'][^>]*\/?>/i,
      ''
    )
  }

  const safeCanonical = escapeHtmlAttribute(canonical)
  const canonicalTag = '<link rel="canonical" href="' + safeCanonical + '" data-rh="true">'
  const canonicalPattern = /<link\b[^>]*\brel=(?:"canonical"|'canonical')[^>]*>/i
  if (canonical) {
    if (canonicalPattern.test(updatedHtml)) {
      updatedHtml = updatedHtml.replace(canonicalPattern, canonicalTag)
    } else {
      updatedHtml = updatedHtml.replace(/<title>[^<]*<\/title>/i, function (m) { return m + '\n      ' + canonicalTag })
    }
  }

  const safeDescription = escapeHtmlAttribute(description)
  // The robots meta must say what the X-Robots-Tag header says. A page whose header excludes
  // it and whose body invites indexing gets crawled by whichever signal a crawler trusts more.
  const routeTags = '</title>\n' +
    renderDescriptionTags(description) +
    '      <meta name="robots" content="' + (noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX) + '" data-rh="true">\n' +
    (title ? '      <meta property="og:title" content="' + escapeHtmlAttribute(title) + '" data-rh="true">\n' : '') +
    (canonical ? '      <meta property="og:url" content="' + safeCanonical + '" data-rh="true">\n' : '') +
    (description ? '      <meta property="og:description" content="' + safeDescription + '" data-rh="true">\n' : '') +
    '      <meta property="og:site_name" content="' + SITE_NAME + '" data-rh="true">\n' +
    '      <meta property="og:locale" content="' + LOCALE + '" data-rh="true">\n' +
    '      <meta property="og:type" content="website" data-rh="true">\n' +
    (image ? '      <meta property="og:image" content="' + escapeHtmlAttribute(image) + '" data-rh="true">\n' : '') +
    // The app declares the Twitter pair on these pages, so the first byte must carry it too:
    // a tag only one side publishes is a tag Helmet deletes or duplicates.
    '      <meta name="twitter:card" content="' + TWITTER_CARD + '" data-rh="true">\n' +
    (title ? '      <meta name="twitter:title" content="' + escapeHtmlAttribute(title) + '" data-rh="true">\n' : '') +
    (description ? '      <meta name="twitter:description" content="' + safeDescription + '" data-rh="true">\n' : '') +
    (image ? '      <meta name="twitter:image" content="' + escapeHtmlAttribute(image) + '" data-rh="true">\n' : '')

  return updatedHtml.replace('</title>', routeTags)
}

module.exports = {
  SITE_NAME,
  LOCALE,
  ROBOTS_INDEX,
  ROBOTS_NOINDEX,
  TWITTER_CARD,
  thumbUrl,
  escapeHtmlAttribute,
  normalizeImageId,
  sanitizeImageId,
  stripExistingMetaTags,
  renderDescriptionTags,
  renderNotFoundDocument,
  renderRootBody,
  buildSeoBody,
  injectMetaTags,
  injectRouteTags,
  htmlResponse
}
