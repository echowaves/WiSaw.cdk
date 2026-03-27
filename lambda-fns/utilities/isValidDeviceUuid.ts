const DEVICE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidDeviceUuid (value: string): boolean {
  return DEVICE_UUID_REGEX.test(value)
}
