const PHOTO_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidPhotoId (value: string): boolean {
  return PHOTO_ID_REGEX.test(value)
}
