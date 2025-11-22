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
    pageTitle = ''
  } = options

  const safeDescription = escapeHtmlAttribute(description)
  const safeEntityLabel = escapeHtmlAttribute(entityLabel)
  const safeOgType = escapeHtmlAttribute(ogType)
  const safePathSegment = escapeHtmlAttribute(pathSegment)
  const safeImageIdUrl = escapeHtmlAttribute(imageIdUrl)
  const safePageTitle = pageTitle
    ? escapeHtmlAttribute(pageTitle)
    : `wisaw ${safeEntityLabel} ${imageIdText}`

  let updatedHtml = html
  updatedHtml = updatedHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${safePageTitle}</title>`
  )

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
