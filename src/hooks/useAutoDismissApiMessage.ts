import { useEffect } from "react"

export const API_RESPONSE_MESSAGE_TTL_MS = 5000

export function useAutoDismissApiMessage<T>(
  value: T | null | undefined,
  clear: () => void,
  delayMs = API_RESPONSE_MESSAGE_TTL_MS,
) {
  useEffect(() => {
    if (!value) return
    const timer = window.setTimeout(clear, delayMs)
    return () => window.clearTimeout(timer)
  }, [value, clear, delayMs])
}
