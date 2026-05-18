"use client"

import { useState } from "react"
import { DropdownList } from "react-widgets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useDispatch } from "react-redux"
import { AppDispatch } from "../../../../redux/store"
import { addTenantUser } from "../../../../actions/auth"
const rolesJson = [
  { "value": "tenant-admin", "label": "Tenant Admin" },
  { "value": "editor", "label": "Editor" },
  { "value": "member", "label": "Member" },
  { "value": "viewer", "label": "Viewer" }
]

export default function AddUserPage() {
  const dispatch = useDispatch<AppDispatch>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const staticRoles = (rolesJson as unknown as Array<{ value: string; label: string }>);
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [roles, setRoles] = useState<Array<{ value: string; label: string }>>(staticRoles);
  const [loadingRoles, setLoadingRoles] = useState(false);

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
    const payload: Record<string, any> = {
      email: email.trim(),
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      isActive: isActive ? 1 : 0,
    }

    if (role) payload.role = role

    try {
      const resp = await dispatch(addTenantUser(payload as any) as any)

      const message = resp?.message || (resp?.user ? "User created successfully." : "User created.")
      setSuccess(String(message))

      // Clear form
      setFirstName("")
      setLastName("")
      setEmail("")
      setRole("")
      setIsActive(false)
    } catch (err: any) {
      // Normalize backend error responses (ApiError shape: { message, details })
      let formMessage = "Submission failed"
      const detailErrors: Record<string, string> = {}

      if (err?.response?.data) {
        const d = err.response.data
        if (typeof d === "string") formMessage = d
        else if (d?.message) formMessage = String(d.message)
        else if (d?.error) formMessage = String(d.error)

        if (d?.details && typeof d.details === "object") {
          for (const k of Object.keys(d.details)) {
            try {
              detailErrors[k] = String((d.details as any)[k])
            } catch {
              // ignore
            }
          }
        }
      } else if (err?.message) {
        formMessage = err.message
      }

      if (Object.keys(detailErrors).length) {
        setErrors(detailErrors)
      } else {
        setErrors({ form: formMessage })
      }
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
            <CardTitle>Add a new user</CardTitle>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                
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
                    inputProps={{ id: "role", className: "h-8" }}
                  />
                </div>

                <div className="flex items-center">
                  <label className="inline-flex items-center gap-3 cursor-pointer">
                    <span className="text-sm font-medium select-none">Active</span>
                    <Switch data-size="lg" id="isActive" checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} className="h-14 w-14 cursor-pointer"/>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={submitting} className="bg-primary py-4 px-4 cursor-pointer">
                  {submitting ? "Saving..." : "Add User"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
