/* eslint-env node */
/* global module */
const escapeHtmlAttribute = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

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
    .replace(/<meta\s[^>]*name=["']twitter:(card|title|image|description)["'][^>]*\/?>\s*/gi, '')
    // The shipped template carries one tag with both name="description" and
    // property="og:description". Attribute order must not matter: the old pattern
    // required name= before property= and would leave a reversed tag behind, which
    // becomes a second description once the injector adds its own.
    .replace(/<meta\s(?=[^>]*\bname=["']description["'])[^>]*\/?>\s*/gi, '')
    .replace(/<meta\s(?=[^>]*\bproperty=["']og:description["'])[^>]*\/?>\s*/gi, '')
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

// Replaces the contents of the static <div id="root"> shell with crawler-visible
// markup. React hydration replaces this subtree with the live app; it exists so a
// fetch without JavaScript still yields a title, an image with alt text, real links,
// and structured data.
function renderRootBody (html = '', bodyHtml = '') {
  if (!bodyHtml) return html
  const marker = /(<div id="root">)[\s\S]*?(<\/div>)/i
  if (!marker.test(html)) return html
  return html.replace(marker, (_m, open, close) => open + bodyHtml + close)
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
    duration = '',
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
  const imageUrl = `https://img.wisaw.com/${encodeURIComponent(imageIdText)}.webp`
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
        thumbnailUrl: imageUrl,
        uploadDate: created || undefined,
        contentUrl: videoUrl || undefined,
        embedUrl: pageUrl,
        duration: duration || undefined,
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
        copyrightYear: new Date().getFullYear(),
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
      '      <meta property="og:image" content="https://img.wisaw.com/' + safeImageIdUrl + '.webp" data-rh="true">\n' +
      '      <meta property="og:description" content="' + safeDescription + '" data-rh="true">\n' +
      '      <meta property="og:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta property="og:url" content="https://wisaw.com/' + safePathSegment + '/' + safeCanonicalId + '" data-rh="true">\n' +
      '      <meta property="og:site_name" content="wisaw.com">\n' +
      '      <meta property=\'og:type\' content=\'' + safeOgType + '\' data-rh="true"/>\n' +
      '      <meta name="twitter:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta name="twitter:card" content="summary_large_image" data-rh="true">\n' +
      '      <meta name="twitter:image" content="https://img.wisaw.com/' + safeImageIdUrl + '.webp" data-rh="true">\n'

  if (videoUrl) {
    const safeVideoUrl = escapeHtmlAttribute(videoUrl)
    metaTags += '      <meta property="og:video" content="' + safeVideoUrl + '" data-rh="true">\n'
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
// wisaw.com/. Same escaping rules as the media injector; no og:image because these routes
// have no single representative image.
function injectRouteTags (html = '', options = {}) {
  const { title = '', description = '', canonical = '', siteName = 'WiSaw' } = options

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
  const routeTags = '</title>\n' +
    renderDescriptionTags(description) +
    (title ? '      <meta property="og:title" content="' + escapeHtmlAttribute(title) + '" data-rh="true">\n' : '') +
    (canonical ? '      <meta property="og:url" content="' + safeCanonical + '" data-rh="true">\n' : '') +
    (description ? '      <meta property="og:description" content="' + safeDescription + '" data-rh="true">\n' : '') +
    '      <meta property="og:site_name" content="' + escapeHtmlAttribute(siteName) + '">\n' +
    '      <meta property="og:type" content="website" data-rh="true">\n'

  return updatedHtml.replace('</title>', routeTags)
}

module.exports = {
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
