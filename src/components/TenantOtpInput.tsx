"use client"

import { useEffect, useRef } from "react"

import { cn } from "../lib/utils"

type TenantOtpInputProps = {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
}

export function TenantOtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
}: TenantOtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const normalized = value.replace(/[^0-9]/g, "").slice(0, length)
  const digits = Array.from({ length }, (_, index) => normalized[index] || "")

  useEffect(() => {
    if (!autoFocus || disabled) {
      return
    }

    const timer = window.setTimeout(() => {
      inputRefs.current[0]?.focus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [autoFocus, disabled])

  const focusIndex = (index: number) => {
    inputRefs.current[index]?.focus()
  }

  const updateValue = (nextDigits: string[]) => {
    onChange(nextDigits.join("").slice(0, length))
  }

  const handleChange = (index: number, raw: string) => {
    const nextChar = raw.replace(/[^0-9]/g, "").slice(-1)
    const nextDigits = [...digits]
    nextDigits[index] = nextChar
    updateValue(nextDigits)

    if (nextChar && index < length - 1) {
      focusIndex(index + 1)
    }
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      if (digits[index]) {
        const nextDigits = [...digits]
        nextDigits[index] = ""
        updateValue(nextDigits)
        return
      }

      if (index > 0) {
        focusIndex(index - 1)
        const nextDigits = [...digits]
        nextDigits[index - 1] = ""
        updateValue(nextDigits)
      }
      return
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      focusIndex(index - 1)
      return
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault()
      focusIndex(index + 1)
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length)
    if (!pasted) {
      return
    }

    const nextDigits = Array.from({ length }, (_, index) => pasted[index] || "")
    updateValue(nextDigits)

    const nextIndex = Math.min(pasted.length, length - 1)
    focusIndex(nextIndex)
  }

  return (
    <div className="flex w-full items-center justify-between gap-2 sm:gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          className={cn(
            "h-12 w-10 rounded-md border border-input bg-background text-center text-base font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-12 sm:text-lg",
            digit ? "border-primary/60 bg-primary/5" : "",
          )}
        />
      ))}
    </div>
  )
}
