// Types for seoRules.js, which stays plain CommonJS so Lambda@Edge can load it straight out of
// the zipped folder (see mediaNaming.d.ts for the same arrangement).

/** Finished crawler-facing strings; `kind` guards against serving a photo's title on a video URL. */
export interface SeoStrings {
  kind: string
  title: string
  description: string
  imageTitle: string
  imageCaption: string
}

export interface SeoRecord {
  v?: number
  caption?: string
  labels?: unknown[]
  created?: string
  location?: string
  width?: string | number
  height?: string | number
  /** Whole seconds, present only when the video's container has actually been read. */
  duration?: number
  /** Finished strings written by the record's author; the edge renders them verbatim. */
  seo?: { kind?: string, title?: string, description?: string, imageTitle?: string, imageCaption?: string }
  [key: string]: unknown
}

export interface SeoFields {
  pageTitle: string
  metaDescription: string
  caption: string
  imageTitle: string
  imageCaption: string
  labels: string[]
  location: string
  created: string
  width: string
  height: string
  /** Whole seconds, or null when nobody has measured this video. */
  duration: number | null
}

export interface BuildSeoFieldsInput {
  sidecar?: SeoRecord | null
  entityLabel?: string
  imageIdText?: string
  lastModified?: string
}

export declare const SIDECAR_VERSION: number
export declare const RECORD_CAPTION_MAX: number
export declare const KIND_LABEL: Record<string, string>
export declare const TITLE_MAX: number
export declare const HEAD_MIN: number
export declare const SUBJECT_MAX: number
export declare const DESC_MAX: number
export declare const IMAGE_TITLE_MAX: number
export declare const IMAGE_CAPTION_MAX: number
export declare const OG_IMAGE_CAPTION_MAX: number
export declare const TAG_TITLE_LIMIT: number
export declare const LABEL_LIMIT: number
export declare const PRECISE_KEYS: string[]
export declare const MAX_DURATION_SECONDS: number

/** Whole positive seconds from a number, "48", "0:48", "1:02:03" or "PT1M2S"; null when unknown. */
export declare function durationSeconds (value: unknown): number | null
/** ISO 8601 for VideoObject.duration; "" when the value is not a real duration. */
export declare function iso8601Duration (value: unknown): string

export declare function clean (value: unknown): string
export declare function truncateWords (value: unknown, max: number): string
export declare function monthYear (isoDate: unknown): string
export declare function normaliseLabels (labels: unknown, limit?: number): string[]
export declare function pickLabels (rows: unknown, limit?: number): string[]
export declare function locationText (row: any): string
export declare function isPreciseLocation (value: unknown): boolean
export declare function assertNoPreciseLocation (body: Record<string, any>): void
export declare function identityTitle (media: any, kind: string): string
export declare function splitImageText (media: any, kindLabel?: string): { title: string, caption: string }
export declare function descriptionLead (caption: string, labels: string[], kindLabel: string, leadBudget: number): string
export declare function buildSeoFields (input?: BuildSeoFieldsInput): SeoFields
/** The record every writer publishes: raw fields plus the finished strings built from them. */
export declare function buildSeoRecord (photo: any): SeoRecord & { seo: SeoStrings }
