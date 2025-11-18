import type { QueryResult } from 'pg'
import ServerlessClient from 'serverless-postgres'
const { env } = process

type ServerlessConfig = Record<string, unknown>

type ConnectionHealthStatus = 'unknown' | 'healthy' | 'unhealthy'

interface ServerlessClientLike {
  connect: () => Promise<void>
  query: (query: string, values?: readonly unknown[]) => Promise<QueryResult>
  clean: () => Promise<unknown>
  end: () => Promise<void>
  setConfig?: (config: ServerlessConfig) => void
  _client?: unknown
}

type ServerlessClientConstructor = new (config: ServerlessConfig) => ServerlessClientLike

const ServerlessClientClass = ServerlessClient as unknown as ServerlessClientConstructor

const CONNECTION_ERROR_CODES = new Set([
  '57P01', // ADMIN_SHUTDOWN
  '57P02', // CRASH_SHUTDOWN
  '57P03', // CANNOT_CONNECT_NOW
  '53300', // TOO_MANY_CONNECTIONS
  '08000', // CONNECTION_EXCEPTION
  '08001', // SQLCLIENT_UNABLE_TO_ESTABLISH_SQLCONNECTION
  '08003', // CONNECTION_DOES_NOT_EXIST
  '08004', // SQLSERVER_REJECTED_ESTABLISHMENT
  '08006' // CONNECTION_FAILURE
])

const CONNECTION_ERROR_PATTERNS = [
  /terminating connection due to administrator command/i,
  /connection terminated unexpectedly/i,
  /too many clients/i,
  /sorry, too many clients already/i,
  /server closed the connection/i,
  /client has encountered a connection error/i,
  /connection error/i,
  /socket hang up/i,
  /econnreset/i,
  /closed the connection unexpectedly/i
]

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30000
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 5000
const DEFAULT_MAX_LIFETIME_MS = 10 * 60 * 1000

function parsePositiveInt (raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

class ManagedServerlessClient {
  private client: ServerlessClientLike
  private readonly baseConfig: ServerlessConfig
  private readonly healthCheckIntervalMs: number
  private readonly healthCheckTimeoutMs: number
  private readonly maxLifetimeMs: number
  private readonly debugEnabled: boolean
  private healthStatus: ConnectionHealthStatus = 'unknown'
  private lastHealthCheckAt = 0
  private pendingHealthCheck: Promise<void> | null = null
  private connecting: Promise<void> | null = null
  private connectionCreatedAt = 0

  constructor (config: ServerlessConfig) {
    this.baseConfig = { ...config }
    this.client = this.createClient()
    this.healthCheckIntervalMs = parsePositiveInt(
      env.PG_HEALTH_CHECK_INTERVAL_MS,
      DEFAULT_HEALTH_CHECK_INTERVAL_MS
    )
    this.healthCheckTimeoutMs = parsePositiveInt(
      env.PG_HEALTH_CHECK_TIMEOUT_MS,
      DEFAULT_HEALTH_CHECK_TIMEOUT_MS
    )
    this.maxLifetimeMs = parsePositiveInt(
      env.PG_CONNECTION_MAX_LIFETIME_MS,
      DEFAULT_MAX_LIFETIME_MS
    )
    this.debugEnabled = env.PG_CLIENT_DEBUG === 'true'
  }

  async connect (): Promise<void> {
    await this.ensureConnected()
    await this.runHealthCheck(true)
  }

  async query<T = unknown> (
    queryText: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>> {
    await this.ensureConnected()
    try {
      await this.runHealthCheck()
      const result = await this.client.query(queryText, values)
      return result as QueryResult<T>
    } catch (error) {
      if (this.isConnectionError(error)) {
        await this.handleConnectionFailure(error as Error)
        await this.ensureConnected()
        await this.runHealthCheck(true)
        const retryResult = await this.client.query(queryText, values)
        return retryResult as QueryResult<T>
      }
      throw error
    }
  }

  async clean (): Promise<void> {
    if (!this.hasActiveClient()) {
      return
    }
    try {
      await this.client.clean()
    } catch (error) {
      if (this.isConnectionError(error)) {
        await this.handleConnectionFailure(error as Error)
      } else {
        throw error
      }
    }
  }

  async end (): Promise<void> {
    await this.safeEnd()
    this.healthStatus = 'unknown'
  }

  getHealthStatus (): ConnectionHealthStatus {
    return this.healthStatus
  }

  private createClient (): ServerlessClientLike {
    return new ServerlessClientClass({ ...this.baseConfig })
  }

  private hasActiveClient (): boolean {
    const rawClient = (this.client as { _client?: unknown })._client
    return rawClient !== undefined && rawClient !== null
  }

  private async ensureConnected (): Promise<void> {
    if (this.hasActiveClient()) {
      if (this.hasConnectionExpired()) {
        this.logDebug('Connection lifetime exceeded; rotating connection')
        await this.restartClient()
      } else {
        return
      }
    }
    if (this.connecting === null) {
      this.connecting = this.client.connect().finally(() => {
        this.connecting = null
      })
    }
    await this.connecting
    this.connectionCreatedAt = Date.now()
  }

  private hasConnectionExpired (): boolean {
    if (this.connectionCreatedAt === 0) {
      return false
    }
    return Date.now() - this.connectionCreatedAt >= this.maxLifetimeMs
  }

  private async runHealthCheck (force = false): Promise<void> {
    if (!this.hasActiveClient()) {
      return
    }
    if (!force && this.healthStatus === 'healthy') {
      const elapsed = Date.now() - this.lastHealthCheckAt
      if (elapsed < this.healthCheckIntervalMs) {
        return
      }
    }
    if (!force && this.pendingHealthCheck !== null) {
      await this.pendingHealthCheck
      return
    }

    const check = this.performHealthCheck()
    this.pendingHealthCheck = check
    try {
      await check
    } finally {
      this.pendingHealthCheck = null
    }
  }

  private async performHealthCheck (): Promise<void> {
    try {
      await this.withTimeout(
        this.client.query('SELECT 1'),
        this.healthCheckTimeoutMs,
        `PostgreSQL health check timed out after ${this.healthCheckTimeoutMs}ms`
      )
      this.healthStatus = 'healthy'
      this.lastHealthCheckAt = Date.now()
      this.logDebug('Health check succeeded')
    } catch (error) {
      this.healthStatus = 'unhealthy'
      this.lastHealthCheckAt = Date.now()
      if (this.isConnectionError(error)) {
        this.logWarn('Health check failed; restarting connection', error)
        await this.handleConnectionFailure(error as Error)
      }
      throw error
    }
  }

  private isConnectionError (error: unknown): boolean {
    if (error === null || error === undefined) {
      return false
    }
    const code = (error as { code?: string }).code
    if (typeof code === 'string' && code.length > 0 && CONNECTION_ERROR_CODES.has(code)) {
      return true
    }
    const message = (error as { message?: string }).message ?? ''
    return CONNECTION_ERROR_PATTERNS.some((pattern) => pattern.test(message))
  }

  private async handleConnectionFailure (error: Error): Promise<void> {
    this.logWarn('Connection marked unhealthy; restarting', error)
    await this.restartClient()
  }

  private async restartClient (): Promise<void> {
    await this.safeEnd()
    this.client = this.createClient()
    this.connecting = null
    this.healthStatus = 'unknown'
    this.lastHealthCheckAt = 0
    this.connectionCreatedAt = 0
  }

  private async safeEnd (): Promise<void> {
    const rawClient = (this.client as { _client?: { end?: () => void } | null })._client
    if (rawClient === undefined || rawClient === null) {
      return
    }
    try {
      await this.client.end()
    } catch (error) {
      this.logWarn('Error closing PostgreSQL client', error)
    }
  }

  private async withTimeout<T> (
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutError = new Error(timeoutMessage) as Error & { code?: string }
        timeoutError.name = 'HealthCheckTimeoutError'
        timeoutError.code = 'HEALTH_CHECK_TIMEOUT'
        reject(timeoutError)
      }, timeoutMs)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle)
      }
    }
  }

  private logDebug (message: string, error?: unknown): void {
    if (!this.debugEnabled) {
      return
    }
    if (error !== undefined && error !== null) {
      console.debug({ context: 'psql', message, error })
    } else {
      console.debug({ context: 'psql', message })
    }
  }

  private logWarn (message: string, error?: unknown): void {
    if (error !== undefined && error !== null) {
      console.warn({ context: 'psql', message, error })
    } else {
      console.warn({ context: 'psql', message })
    }
  }
}

const psql = new ManagedServerlessClient({
  ...env,
  delayMs: 3000,
  maxConnections: 80,
  maxRetries: 3,
  ssl: true,
  processCountCacheEnabled: true,
  debug: env.PG_CLIENT_DEBUG === 'true'
})

export default psql
