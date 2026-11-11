/* eslint-env node */
/* global require, module, console, BigInt */

// How long a stored video really is.
//
// Nothing in the pipeline is told this: the mobile app uploads the bytes and never reports a
// length, and a live probe of production found user metadata on none of the 842 video objects
// (_bmad-output/seo-indexing/evidence/probe-duration-metadata.js), so the edge's HeadObject read
// has always answered "". The number does exist though - it is written into every QuickTime/MP4
// container by the camera that made the file, in mvhd inside moov. Reading it costs two ranged
// GETs, and unlike a heuristic over file size it is the truth rather than a guess.
//
// Only headers are read: a head window catches files whose moov is first (the usual "faststart"
// layout) and a tail window catches iPhone recordings, which write moov last. A box header that
// lies about its size stops the parse instead of buffering the object, and an implausible result
// is discarded - this module returns null far more often than it guesses.

const HEAD_WINDOW_BYTES = 128 * 1024
const TAIL_WINDOW_BYTES = 512 * 1024
// mvhd sits at the front of moov; scanning further means reading bytes that cannot hold it.
const MOOV_SCAN_BYTES = 64 * 1024
// A box that claims to be larger than this is corrupt, not a long video.
const MAX_BOX_BYTES = 512 * 1024 * 1024
// Longer than a day is a broken header. Mirrors seoRules.MAX_DURATION_SECONDS.
const MAX_DURATION_SECONDS = 86400
const MAX_BOXES_PER_LEVEL = 512

function readBoxHeader (buf, index) {
  if (index < 0 || index + 8 > buf.length) return null
  const type = buf.toString('latin1', index + 4, index + 8)
  const declared = buf.readUInt32BE(index)

  if (declared === 1) {
    if (index + 16 > buf.length) return null
    const large = buf.readBigUInt64BE(index + 8)
    if (large < 16n || large > BigInt(MAX_BOX_BYTES)) return null
    return { type, size: Number(large), headerSize: 16 }
  }
  // size 0 means "to the end of the container", which only the caller knows.
  if (declared === 0) return { type, size: null, headerSize: 8 }
  if (declared < 8) return null
  return { type, size: declared, headerSize: 8 }
}

/**
 * Walks sibling boxes of one buffer and returns the body bounds of the first match.
 * @param {Buffer} buf bytes starting at `base` in the file
 * @param {number} base absolute file offset of buf[0]
 * @param {number} containerEnd absolute offset one past the last byte of this level
 */
function findBox (buf, base, containerEnd, type) {
  let index = 0
  for (let i = 0; i < MAX_BOXES_PER_LEVEL; i++) {
    const header = readBoxHeader(buf, index)
    if (header == null) return null
    const bodyStart = base + index + header.headerSize
    const boxEnd = header.size == null ? containerEnd : Math.min(base + index + header.size, containerEnd)
    if (header.type === type && boxEnd > bodyStart) return { start: bodyStart, end: boxEnd }
    if (header.size == null) return null // an open-ended box we are not after ends this level
    index += header.size
  }
  return null
}

// In the tail window nothing tells us where a top-level box starts, so every "moov" signature is
// tried as one: a box's type name sits four bytes after its size field, so the header candidate is
// always hit - 4 and readBoxHeader() decides whether the size is the wide form.
function findTrailingBox (buf, base, containerEnd, type) {
  const signature = Buffer.from(type, 'latin1')
  let hit = buf.indexOf(signature)

  while (hit > 3) {
    const index = hit - 4
    const header = readBoxHeader(buf, index)
    if (header != null && header.type === type) {
      const bodyStart = base + index + header.headerSize
      const boxEnd = header.size == null ? containerEnd : Math.min(base + index + header.size, containerEnd)
      if (boxEnd > bodyStart) return { start: bodyStart, end: boxEnd }
    }
    hit = buf.indexOf(signature, hit + 1)
  }
  return null
}

function secondsFromTimescale (timescale, duration) {
  if (!Number.isFinite(timescale) || timescale <= 0) return null
  if (!(duration > 0n)) return null
  const seconds = Math.floor(Number(duration) / timescale)
  if (seconds <= 0 || seconds > MAX_DURATION_SECONDS) return null
  return seconds
}

/** @param {Buffer} buf bytes from the mvhd version byte */
function secondsFromMvhd (buf) {
  const version = buf[0]
  // v0: 4s creation + 4s modification, then timescale/int32 duration. v1 widens both clock
  // fields and stores duration as uint64 at offset 24.
  if (version === 1) {
    if (buf.length < 32) return null
    return secondsFromTimescale(buf.readInt32BE(20), buf.readBigUInt64BE(24))
  }
  if (version === 0) {
    if (buf.length < 20) return null
    return secondsFromTimescale(buf.readInt32BE(12), BigInt(buf.readInt32BE(16)))
  }
  return null
}

async function readWindow (source, offset, length) {
  const size = Number(source.size)
  const start = Math.max(0, Math.floor(offset))
  if (!(size > start) || !(length > 0)) return Buffer.alloc(0)
  const end = Math.min(size, start + Math.floor(length))
  const bytes = await source.read(start, end - start)
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
}

/**
 * Seconds of video in one container, or null when the file does not say.
 * @param {{size: number, read: (offset:number,length:number)=>Promise<Buffer>}} source ranged reader
 */
async function durationFromContainer (source) {
  const size = Number(source && source.size)
  if (!Number.isFinite(size) || size < 32) return null

  const head = await readWindow(source, 0, HEAD_WINDOW_BYTES)
  let moov = findBox(head, 0, Math.min(size, head.length), 'moov')

  if (moov == null && size > TAIL_WINDOW_BYTES) {
    const base = size - TAIL_WINDOW_BYTES
    const tail = await readWindow(source, base, TAIL_WINDOW_BYTES)
    moov = findTrailingBox(tail, base, size, 'moov')
  }
  if (moov == null) return null

  const body = await readWindow(source, moov.start, Math.min(moov.end - moov.start, MOOV_SCAN_BYTES))
  const mvhd = findBox(body, moov.start, Math.min(moov.end, moov.start + body.length), 'mvhd')
  if (mvhd == null) return null

  const from = mvhd.start - moov.start
  return secondsFromMvhd(body.subarray(from, Math.min(mvhd.end - moov.start, body.length)))
}

module.exports = { durationFromContainer, MAX_DURATION_SECONDS }
