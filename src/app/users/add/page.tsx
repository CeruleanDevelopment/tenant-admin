"use client"

import { useState } from "react"
import { DropdownList } from "react-widgets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
const rolesJson = [
  { "value": "tenant-admin", "label": "Tenant Admin" },
  { "value": "editor", "label": "Editor" },
  { "value": "member", "label": "Member" },
  { "value": "viewer", "label": "Viewer" }
]


export default function AddUserPage() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const staticRoles = (rolesJson as unknown as Array<{ value: string; label: string }>)
  // no default selection — empty string will show placeholder
  const [role, setRole] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [roles, setRoles] = useState<Array<{ value: string; label: string }>>(staticRoles)
  const [loadingRoles, setLoadingRoles] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = "First name is required"
    if (!lastName.trim()) e.lastName = "Last name is required"
    if (!email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email"
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const v = validate()
    if (Object.keys(v).length) {
      setErrors(v)
      return
    }
    setSubmitting(true)
    setErrors({})
    setSuccess("")
    const payload = { firstName, lastName, email, role, isActive }
    try {
      // const res = await fetch("/api/users", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(payload),
      // })
      // if (!res.ok) {
      //   const text = await res.text().catch(() => "")
      //   throw new Error(text || "Failed to create user")
      // }
      setSuccess("User created successfully.")
      setFirstName("")
      setLastName("")
      setEmail("")
      // reset to placeholder (no selection)
      setRole("")
      setIsActive(true)
    } catch (err: any) {
      setErrors({ form: err?.message || "Submission failed" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Add User</h1>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Create a new user</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.form && <div className="text-sm text-red-600">{errors.form}</div>}
              {success && <div className="text-sm text-green-600">{success}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="mb-1">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                  {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <Label htmlFor="lastName" className="mb-1">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                  {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="mb-1">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
                {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <Label htmlFor="role" className="mb-1">Role</Label>
                  <DropdownList
                    data={roles}
                    dataKey="value"
                    textField="label"
                    value={roles.find((r) => r.value === role) || null}
                    onChange={(val) => setRole((val as any)?.value || "")}
                    disabled={loadingRoles}
                    placeholder={loadingRoles ? "Loading roles..." : "Select role"}
                    className="w-full"
                    inputProps={{ id: "role", className: "h-10" }}
                  />
                </div>

                <div className="flex items-center">
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <span className="text-sm select-none">Active</span>
                    <Switch data-size="lg" id="isActive" checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} className="h-14 w-14 cursor-pointer"/>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={submitting} className="bg-primary">
                  {submitting ? "Saving..." : "Create User"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
