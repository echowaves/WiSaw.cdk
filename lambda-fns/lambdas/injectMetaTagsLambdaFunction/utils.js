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

function sanitizeImageId(uri = '') {
  const normalized = normalizeImageId(uri)
  return {
    raw: normalized,
    text: escapeHtmlAttribute(normalized),
    url: escapeHtmlAttribute(encodeURIComponent(normalized))
  }
}

function injectMetaTags(html = '', options = {}) {
  const {
    description = '',
    entityLabel = '',
    ogType = '',
    pathSegment = '',
    imageIdText = '',
    imageIdUrl = '',
    created = new Date().toISOString(),
    pageTitle = '',
    duration = 'PT0S',
    contentUrl = `https://img.wisaw.com/${imageIdUrl}.mov`,
    embedUrl = `https://wisaw.com/${pathSegment}/${imageIdUrl}`,
    interactionCount = 0,
    thumbnailUrls = [],
    regionsAllowed = []
  } = options

  const safeDescription = escapeHtmlAttribute(description)
  const safeEntityLabel = escapeHtmlAttribute(entityLabel)
  const safeOgType = escapeHtmlAttribute(ogType)
  const safePathSegment = escapeHtmlAttribute(pathSegment)
  const safeImageIdUrl = escapeHtmlAttribute(imageIdUrl)
  const safeContentUrl = escapeHtmlAttribute(contentUrl)
  const safeEmbedUrl = escapeHtmlAttribute(embedUrl)
  const safeDuration = escapeHtmlAttribute(duration)
  const safePageTitle = pageTitle
    ? escapeHtmlAttribute(pageTitle)
    : `wisaw ${safeEntityLabel} ${imageIdText}`

  const resolvedThumbnails = (Array.isArray(thumbnailUrls) && thumbnailUrls.length > 0
    ? thumbnailUrls
    : [`https://img.wisaw.com/${safeImageIdUrl}.webp`]
  ).map(escapeHtmlAttribute)

  const resolvedRegions = Array.isArray(regionsAllowed)
    ? regionsAllowed.map(escapeHtmlAttribute).filter(Boolean)
    : []

  const numericInteractions = Number.isFinite(Number(interactionCount))
    ? Math.max(0, Math.trunc(Number(interactionCount)))
    : 0

  let updatedHtml = html
  updatedHtml = updatedHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${safePageTitle}</title>`
  )

  let jsonLd = ''
  if (ogType === 'video') {
    const videoObject = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: safePageTitle,
      description: safeDescription,
      thumbnailUrl: resolvedThumbnails,
      uploadDate: created,
      duration: safeDuration,
      contentUrl: safeContentUrl,
      embedUrl: safeEmbedUrl,
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: { '@type': 'WatchAction' },
        userInteractionCount: numericInteractions
      }
    }

    if (resolvedRegions.length > 0) {
      videoObject.regionsAllowed = resolvedRegions
    }

    jsonLd = `
    <script type="application/ld+json">
    ${JSON.stringify(videoObject, null, 2)}
    </script>
    `
  }

  return updatedHtml
    .replace(
      '</title>',
      `</title>
      <meta property="og:image" content="https://img.wisaw.com/${safeImageIdUrl}.webp" data-rh="true">
      <meta property="og:description" content="${safeDescription}" data-rh="true">
      <meta property="og:title" content="${safePageTitle}" data-rh="true">
      <meta property="og:url" content="https://wisaw.com/${safePathSegment}/${safeImageIdUrl}" data-rh="true">
      <meta property="og:site_name" content="wisaw.com">
      <meta property='og:type' content='${safeOgType}' data-rh="true"/>
      <meta name="twitter:title" content="${safePageTitle}" data-rh="true">
      <meta name="twitter:card" content="summary_large_image" data-rh="true">
      <meta name="twitter:image" content="https://img.wisaw.com/${safeImageIdUrl}.webp" data-rh="true">
      ${jsonLd}
      `
    )
    .replace(
      `<link rel="canonical" href="https://wisaw.com" data-rh="true"/>`,
      `<link rel='canonical' href="https://wisaw.com/${safePathSegment}/${safeImageIdUrl}" data-rh="true">`
    )
}

module.exports = {
  escapeHtmlAttribute,
  normalizeImageId,
  sanitizeImageId,
  injectMetaTags
}
