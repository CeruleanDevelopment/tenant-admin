const readPublicValue = (value?: string): string => value?.trim() || ""

// const server = readPublicValue(process.env.NEXT_PUBLIC_DEPLOYMENT_ENV).toUpperCase() || "LOCAL"
const server: string = "LOCAL"

let API_URL = "http://localhost:4054"
let WEBSITE_URL = "http://localhost:3001"

if (server === "PRODUCTION") {
  API_URL = "https://api.ceruleanai.cloud"
  WEBSITE_URL = "https://ceruleanai.cloud"
}

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