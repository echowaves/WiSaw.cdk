export function deployEnv(): string {
  return process.env.DEPLOY_ENV ?? 'test'
}

export function loadConfig(): any {
  const env = deployEnv()
  switch (env) {
    case 'test':
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../.env.test').config()
    case 'prod':
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../.env.prod').config()
    case 'dev':
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../.env.dev').config()
    default:
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../../.env.test').config()
  }
}

export const config = loadConfig()
