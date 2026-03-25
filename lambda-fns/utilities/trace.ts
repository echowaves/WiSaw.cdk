const isTraceEnabled = (): boolean => process.env.TRACE_LOG_ENABLED === 'true'

export function traceLog (label: string, data?: Record<string, unknown>): void {
  if (!isTraceEnabled()) return
  const parts = data !== undefined
    ? Object.entries(data).map(([k, v]) => `${k}=${String(v)}`).join(' ')
    : ''
  console.log(`[TRACE] ${label}${parts.length > 0 ? ' | ' + parts : ''}`)
}

export async function traceWrap<T> (label: string, fn: () => Promise<T>, data?: Record<string, unknown>): Promise<T> {
  if (!isTraceEnabled()) return await fn()
  traceLog(`${label}:START`, data)
  const start = Date.now()
  try {
    const result = await fn()
    traceLog(`${label}:END`, { ...data, duration: `${Date.now() - start}ms` })
    return result
  } catch (error) {
    traceLog(`${label}:ERROR`, { ...data, duration: `${Date.now() - start}ms`, error: String(error) })
    throw error
  }
}
