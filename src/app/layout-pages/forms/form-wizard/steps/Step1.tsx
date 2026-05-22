// app/components/steps/Step1.tsx
"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WizardForm } from "../WizardContext"

export default function Step1({ form, setForm }: { form: WizardForm; setForm: React.Dispatch<React.SetStateAction<WizardForm>> }) {
  return (
    <div className="space-y-6 bg-background rounded-2xl shadow border p-8">

      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold">
          Personal Details
        </h2>
        <p className="text-sm text-muted-foreground">
          Please fill in your personal details below.
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* First Name */}
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input
            placeholder="First Name"
            value={form.firstName || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, firstName: e.target.value }))
            }
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input
            placeholder="Last Name"
            value={form.lastName || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, lastName: e.target.value }))
            }
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label>Phone Number</Label>
          <Input
            placeholder="Phone Number"
            value={form.phone || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label>E-mail Address</Label>
          <Input
            type="email"
            placeholder="Enter Email Address"
            value={form.email || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>

        {/* Country */}
        <div className="space-y-2">
          <Label>Country</Label>
          <Select
            value={form.country}
            onValueChange={(value: string) =>
              setForm((prev) => ({ ...prev, country: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="---" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="india">India</SelectItem>
              <SelectItem value="usa">United States</SelectItem>
              <SelectItem value="uk">United Kingdom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label>Language</Label>
          <Select
            value={form.language}
            onValueChange={(value: string) =>
              setForm((prev) => ({ ...prev, language: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="---" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="english">English</SelectItem>
              <SelectItem value="hindi">Hindi</SelectItem>
              <SelectItem value="spanish">Spanish</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  )
}