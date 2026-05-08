import { API_URL } from "../config/config"
import axios from "axios"
import { store } from "../redux/store"
import {
  clearAuthTokenCookie,
  loadAuthTokenCookie,
} from "../utils/authCookies"
import { clearAuthSession, setAuthInitialized } from "../redux/reducers/Home"
import { clearTenantProfile } from "../redux/reducers/Tenant"

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

const clearApiAuthHeaders = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (api.defaults.headers as any).user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (api.defaults.headers as any).Authorization
}

const clearClientSession = (): void => {
  clearAuthTokenCookie()
  clearApiAuthHeaders()
  store.dispatch(clearAuthSession())
  store.dispatch(clearTenantProfile())
  store.dispatch(setAuthInitialized(true))
}

api.interceptors.request.use((config: any) => {
  const token = store.getState().auth?.token || loadAuthTokenCookie()

  config.headers = config.headers ?? {}

  if (token) {
    config.headers.user = token
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.user
    delete config.headers.Authorization
  }

  if (typeof window !== "undefined") {
    config.headers["x-client-path"] = window.location.pathname
  }

  const method = (config.method || "GET").toString().toUpperCase()
  const url = config.url || "/"
  // eslint-disable-next-line no-console
  console.log(`[tenant-admin] calling API: ${method} ${url}`)

  return config
})

api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    const status = error?.response?.status
    const requestUrl = error?.config?.url || ""
    const isAuthCall = /^\/tenant\/auth\/(signin|signup|google|refresh|logout)$/.test(requestUrl)

    if (status === 401 && !isAuthCall) {
      clearClientSession()
    }

    return Promise.reject(error)
  },
)

export default api
