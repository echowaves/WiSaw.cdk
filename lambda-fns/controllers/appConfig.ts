// lambda-fns/controllers/appConfig.ts

// This endpoint returns static/app-level config.
// Values come from environment variables injected at deploy time.
// In production, these are set via CDK when deploying a new EAS Update branch.

const MIN_APP_VERSION = process.env.MIN_APP_VERSION ?? '1.0.0'
const MIN_APP_BUILD = parseInt(process.env.MIN_APP_BUILD ?? '0', 10)
const UPDATE_MESSAGE = process.env.UPDATE_MESSAGE ?? ''

export default async function main (): Promise<{
  minAppVersion: string
  minAppBuild: number
  message: string
}> {
  return {
    minAppVersion: MIN_APP_VERSION,
    minAppBuild: MIN_APP_BUILD,
    message: UPDATE_MESSAGE
  }
}
