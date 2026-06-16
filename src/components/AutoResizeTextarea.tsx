"use client"

import React, { useRef, useEffect } from "react"

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number
  maxRows?: number
}

export default function AutoResizeTextarea({ minRows = 1, maxRows = 6, style, onInput, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    resize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resize when controlled `value` changes
  useEffect(() => {
    resize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function resize() {
    const ta = ref.current
    if (!ta) return
    ta.style.height = "auto"
    const computed = window.getComputedStyle(ta)
    const lineHeight = parseFloat(computed.lineHeight || "20")
    const padding = parseFloat(computed.paddingTop || "0") + parseFloat(computed.paddingBottom || "0")
    const border = parseFloat(computed.borderTopWidth || "0") + parseFloat(computed.borderBottomWidth || "0")
    const maxHeight = maxRows * lineHeight + padding + border
    const minHeight = minRows * lineHeight + padding + border
    ta.style.height = Math.max(minHeight, Math.min(maxHeight, ta.scrollHeight)) + "px"
  }

  return (
    <textarea
      ref={ref}
      rows={minRows}
      style={{ resize: "none", overflow: "hidden", ...style }}
      onInput={(e) => {
        resize()
        if (onInput) (onInput as unknown as any)(e)
      }}
      {...props}
    />
  )
}
