import * as ReduxTypes from "../../constants/types"

export interface TenantProfile {
  id: string
  slug: string
  name: string
  status?: string
  allowedOrigins?: string[]
  settings?: {
    defaultTopK?: number
    chunkSize?: number
    chunkOverlap?: number
  }
  picture?: string | null
  users?: Array<{
    id: string
    email: string
    name: string
    role: string
  }>
}

export interface TenantState {
  profile: TenantProfile | null
}

export const TENANT_PROFILE_SET = ReduxTypes.TENANT_PROFILE_SET
export const TENANT_PROFILE_CLEAR = ReduxTypes.TENANT_PROFILE_CLEAR

export const initialTenantState: TenantState = {
  profile: null,
}

export const setTenantProfile = (profile: TenantProfile) => ({
  type: TENANT_PROFILE_SET,
  payload: profile,
} as const)

export const clearTenantProfile = () => ({
  type: TENANT_PROFILE_CLEAR,
} as const)

export type TenantAction =
  | ReturnType<typeof setTenantProfile>
  | ReturnType<typeof clearTenantProfile>

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
    case TENANT_PROFILE_CLEAR:
      return {
        ...initialTenantState,
      }
    default:
      return state
  }
}

export const selectTenantState = (state: { tenant: TenantState }): TenantState => state.tenant
export const selectTenantProfile = (state: { tenant: TenantState }): TenantProfile | null => state.tenant.profile
