import { combineReducers, type AnyAction, type Reducer } from "redux"

import { authReducer } from "./Home"
import { tenantReducer } from "./Tenant"

const combinedReducer = combineReducers({
  auth: authReducer,
  tenant: tenantReducer,
})

export const rootReducer: Reducer<RootState, AnyAction> = combinedReducer as unknown as Reducer<
  RootState,
  AnyAction
>
export type RootState = ReturnType<typeof combinedReducer>
