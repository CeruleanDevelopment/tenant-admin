import { applyMiddleware, legacy_createStore as createStore, type AnyAction } from "redux"
import { thunk, type ThunkMiddleware, type ThunkDispatch } from "redux-thunk"

import { rootReducer, type RootState } from "./reducers"

const middleware = [thunk as ThunkMiddleware<RootState, AnyAction>]

export const store = createStore(rootReducer, applyMiddleware(...middleware))

export type AppDispatch = ThunkDispatch<RootState, unknown, AnyAction>
