// Types for videoDuration.js, which stays plain CommonJS so it can be required by a Lambda@Edge
// bundle as well as by the esbuild-bundled lambdas (the arrangement described in mediaNaming.d.ts).

/** A ranged reader over one stored object; `size` must be known before the first read. */
export interface ContainerSource {
  size: number
  read: (offset: number, length: number) => Promise<Buffer>
}

/**
 * Whole seconds of video stored in one QuickTime/MP4 container, or null when the file does not say
 * (no moov, no mvhd, a corrupt header, or an implausible length).
 */
export declare function durationFromContainer (source: ContainerSource): Promise<number | null>

/** Anything longer is treated as a corrupt header rather than published. */
export declare const MAX_DURATION_SECONDS: number
