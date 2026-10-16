import { useEffect, useRef } from "react"

export const API_RESPONSE_MESSAGE_TTL_MS = 5000

export function useAutoDismissApiMessage<T>(
  value: T | null | undefined,
  clear: () => void,
  delayMs = API_RESPONSE_MESSAGE_TTL_MS,
) {
  // Latest callback kept in a ref so an inline `clear` does not restart the timer on each render.
  const clearRef = useRef(clear)
  clearRef.current = clear

  useEffect(() => {
    if (!value) return
    const timer = window.setTimeout(() => clearRef.current(), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
}
