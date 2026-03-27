function isValidUuidFormat (value: string): boolean {
  if (value.length !== 36) return false
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (value[i] !== '-') return false
    } else {
      const c = value.charCodeAt(i)
      if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102))) return false
    }
  }
  return true
}

export function assertValidUuid (value: string, fieldName: string): void {
  if (!isValidUuidFormat(value)) {
    throw new Error(`Wrong UUID format for ${fieldName}: "${value}"`)
  }
}
