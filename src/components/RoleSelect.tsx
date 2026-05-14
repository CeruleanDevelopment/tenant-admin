"use client"

import React from "react"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

type Option = { value: string; label: string }

type RoleSelectProps = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  id?: string
}

export default function RoleSelect({
  value,
  onChange,
  options,
  placeholder = "Select role",
  id = "role",
}: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
