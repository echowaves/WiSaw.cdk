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
    .replace(/<meta\s[^>]*name=["']description["'][^>]*property=["']og:description["'][^>]*\/?>\s*/gi, '')
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

  let updatedHtml = stripExistingMetaTags(html)
  updatedHtml = updatedHtml.replace(
    /<title>.*?<\/title>/i,
    '<title>' + safePageTitle + '</title>'
  )

  let metaTags = '</title>\n' +
      '      <meta property="og:image" content="https://img.wisaw.com/' + safeImageIdUrl + '.webp" data-rh="true">\n' +
      '      <meta property="og:description" content="' + safeDescription + '" data-rh="true">\n' +
      '      <meta property="og:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta property="og:url" content="https://wisaw.com/' + safePathSegment + '/' + safeImageIdUrl + '" data-rh="true">\n' +
      '      <meta property="og:site_name" content="wisaw.com">\n' +
      '      <meta property=\'og:type\' content=\'' + safeOgType + '\' data-rh="true"/>\n' +
      '      <meta name="twitter:title" content="' + safePageTitle + '" data-rh="true">\n' +
      '      <meta name="twitter:card" content="summary_large_image" data-rh="true">\n' +
      '      <meta name="twitter:image" content="https://img.wisaw.com/' + safeImageIdUrl + '.webp" data-rh="true">\n'

  if (videoUrl) {
    const safeVideoUrl = escapeHtmlAttribute(videoUrl)
    metaTags += '      <meta property="og:video" content="' + safeVideoUrl + '" data-rh="true">\n'
  }

  const canonicalUrl = 'https://wisaw.com/' + safePathSegment + '/' + imageIdUrl

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

module.exports = {
  escapeHtmlAttribute,
  normalizeImageId,
  sanitizeImageId,
  stripExistingMetaTags,
  renderRootBody,
  buildSeoBody,
  injectMetaTags
}
