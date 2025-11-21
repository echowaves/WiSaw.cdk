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
    imageIdUrl = ''
  } = options

  const safeDescription = escapeHtmlAttribute(description)
  const safeEntityLabel = escapeHtmlAttribute(entityLabel)
  const safeOgType = escapeHtmlAttribute(ogType)
  const safePathSegment = escapeHtmlAttribute(pathSegment)

  return html
    .replace(
      '</title>',
      `</title>
      <meta property="og:image" content="https://img.wisaw.com/${imageIdUrl}.webp" data-rh="true">
      <meta property="og:description" content="${safeDescription}" data-rh="true">
      <meta property="og:title" content="wisaw ${safeEntityLabel} ${imageIdText}" data-rh="true">
      <meta property="og:url" content="https://wisaw.com/${safePathSegment}/${imageIdUrl}" data-rh="true">
      <meta property="og:site_name" content="wisaw.com">
      <meta property='og:type' content='${safeOgType}' data-rh="true"/>
      <meta name="twitter:title" content="wisaw (What I Saw) ${safeEntityLabel} ${imageIdText}" data-rh="true">
      <meta name="twitter:card" content="summary_large_image" data-rh="true">
      <meta name="twitter:image" content="https://img.wisaw.com/${imageIdUrl}.webp" data-rh="true">
      `
    )
    .replace(
      `<link rel="canonical" href="https://wisaw.com" data-rh="true"/>`,
      `<link rel='canonical' href="https://wisaw.com/${safePathSegment}/${imageIdUrl}" data-rh="true">`
    )
    }

module.exports = {
  escapeHtmlAttribute,
  normalizeImageId,
  sanitizeImageId,
  injectMetaTags
}
