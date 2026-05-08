const DEFAULT_LOCAL_API_URL = "http://localhost:4054"
const DEFAULT_LOCAL_WEBSITE_URL = "http://localhost:3001"

const readPublicValue = (value?: string): string => value?.trim() || ""

const configuredApiUrl = readPublicValue(process.env.NEXT_PUBLIC_API_URL)
const configuredWebsiteUrl = readPublicValue(process.env.NEXT_PUBLIC_WEBSITE_URL)
const configuredDeploymentEnv = readPublicValue(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV)

const API_URL = configuredApiUrl || DEFAULT_LOCAL_API_URL
const WEBSITE_URL = configuredWebsiteUrl || DEFAULT_LOCAL_WEBSITE_URL
const server = configuredDeploymentEnv || "LOCAL"

export const GOOGLE_APP_ID = readPublicValue(process.env.NEXT_PUBLIC_GOOGLE_APP_ID)
export const GOOGLE_APP_SECRET = readPublicValue(process.env.NEXT_PUBLIC_GOOGLE_APP_SECRET)
export { API_URL, WEBSITE_URL, server }

// Backwards-compatible default export used across the tenant-admin codebase
export const tenantAdminConfig = {
  apiUrl: API_URL.replace(/\/$/, ""),
  websiteUrl: WEBSITE_URL.replace(/\/$/, ""),
  deploymentEnv: server,
  googleClientId: GOOGLE_APP_ID,
  googleClientSecret: GOOGLE_APP_SECRET,
}

export default tenantAdminConfig