// Types for the CommonJS naming rule shared by the edge injector (which loads the plain JS file)
// and the bundled TypeScript lambdas. Kept next to the implementation so the two cannot drift:
// the runtime always resolves mediaNaming.js, this file only describes it.

export declare const VIDEO_EXTENSIONS: readonly string[]
export declare const IMAGE_EXTENSION: string
export declare const THUMB_SUFFIX: string
export declare const IMG_HOST: string

export declare function isVideoObjectKey (key?: string): boolean
export declare function isImageObjectKey (key?: string): boolean
export declare function isThumbnailObjectKey (key?: string): boolean
export declare function isSidecarObjectKey (key?: string): boolean
export declare function videoObjectKey (id?: string, resolvedKey?: string): string
export declare function pickVideoObjectKey (id?: string, keys?: string[]): string
export declare function imageObjectKey (id?: string): string
export declare function thumbnailObjectKey (id?: string): string
export declare function imgUrl (key?: string): string
