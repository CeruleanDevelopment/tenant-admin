import * as ReduxTypes from "../../constants/types"
import type { ActiveCountry } from "../../actions/auth"

export interface TenantProfile {
  id: string
  slug: string
  companyName: string
  apiKey?: string | null
  apiSecretHash?: string | null
  secretKey?: string | null
  allowedOrigins?: string[]
  phone?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryId?: string | null
  email?: string | null
  googleProvider?: string | null
  providerId?: string | null
  isActive?: 0 | 1
  settings?: {
    defaultTopK?: number
    chunkSize?: number
    chunkOverlap?: number
  }
  oauth?: {
    clientId?: string
    clientSecret?: string
    authorizationURL?: string
    tokenURL?: string
    callbackURL?: string
    scope?: string[]
  }
  picture?: string | null
  createdAt?: string
  updatedAt?: string
  // users?: Array<{
  //   id: string
  //   email: string
  //   name: string
  //   role: string
  // }>
}

export interface TenantState {
  profile: TenantProfile | null
  countries: ActiveCountry[]
}

export const TENANT_PROFILE_SET = ReduxTypes.TENANT_PROFILE_SET
export const TENANT_PROFILE_CLEAR = ReduxTypes.TENANT_PROFILE_CLEAR
export const TENANT_COUNTRIES_SET = ReduxTypes.TENANT_COUNTRIES_SET

export const initialTenantState: TenantState = {
  profile: null,
  countries: [],
}

export const setTenantProfile = (profile: TenantProfile) => ({
  type: TENANT_PROFILE_SET,
  payload: profile,
} as const)

export const clearTenantProfile = () => ({
  type: TENANT_PROFILE_CLEAR,
} as const)

export const setTenantCountries = (countries: ActiveCountry[]) => ({
  type: TENANT_COUNTRIES_SET,
  payload: countries,
} as const)

export type TenantAction =
  | ReturnType<typeof setTenantProfile>
  | ReturnType<typeof clearTenantProfile>
  | ReturnType<typeof setTenantCountries>

export function tenantReducer(
  state: TenantState = initialTenantState,
  action: TenantAction,
): TenantState {
  switch (action.type) {
    case TENANT_PROFILE_SET:
      return {
        ...state,
        profile: action.payload,
      }
    case TENANT_COUNTRIES_SET:
      return {
        ...state,
        countries: action.payload,
      }
    case TENANT_PROFILE_CLEAR:
      return {
        ...state,
        profile: null,
      }
    default:
      return state
  }
}

export const selectTenantState = (state: { tenant: TenantState }): TenantState => state.tenant
export const selectTenantProfile = (state: { tenant: TenantState }): TenantProfile | null => state.tenant.profile
