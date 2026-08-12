"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDispatch } from "react-redux"
import { AppDispatch } from "../../../../../redux/store"
import { addTenantUser } from "../../../../../actions/auth"

const roleOptions: Array<{ value: string; label: string }> = [
  { value: "tenant-admin", label: "Tenant Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "User" },
]

export default function AddUserPage() {
  const dispatch = useDispatch<AppDispatch>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const roles = roleOptions;
  const loadingRoles = false;

  useEffect(() => {
    if (!success && !errors.form) return

    const timer = setTimeout(() => {
      setSuccess("")
      setErrors((prev) => {
        if (!prev.form) return prev
        const { form, ...rest } = prev
        return rest
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [success, errors.form])

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.firstName = "First name is required"
    if (!lastName.trim()) e.lastName = "Last name is required"
    if (!email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email"
    if (!role.trim()) e.role = "Role is required"
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
    try {
      const resp = await dispatch(addTenantUser({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role: role || "user",
        isActive: isActive ? 1 : 0,
      }))

      let message = "User added."
      if (typeof resp === "object" && resp !== null) {
        const r = resp as { message?: string; user?: unknown }
        message = r.message ?? (r.user ? "User added successfully." : message)
      } else if (typeof resp === "string") {
        message = resp
      }
      setSuccess(String(message))

      setFirstName("")
      setLastName("")
      setEmail("")
      setRole("")
      setIsActive(false)
    } catch (err: unknown) {
      let formMessage = "Submission failed"
      const detailErrors: Record<string, string> = {}

      if (typeof err === "object" && err !== null) {
        const e = err as { response?: { data?: any }; message?: string }
        const d = e.response?.data ?? null
        if (d) {
          if (typeof d === "string") formMessage = d
          else if (d?.message) formMessage = String(d.message)
          else if (d?.error) formMessage = String(d.error)

          if (d?.details && typeof d.details === "object") {
            for (const k of Object.keys(d.details)) {
              try {
                detailErrors[k] = String((d.details as Record<string, unknown>)[k])
              } catch {
                // ignore
              }
            }
          }
        } else if (e.message) {
          formMessage = e.message
        }
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
    <main className="p-0">
      <div className="mx-auto max-w-5xl">
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
                    placeholder="enter first name"
                  />
                  {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                </div>

                <div>
                  <Label htmlFor="lastName" className="mb-1">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="enter last name"
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
                    placeholder="enter email"
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="role" className="mb-1">Role</Label>
                  <Select value={role || undefined} onValueChange={setRole} disabled={loadingRoles}>
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder={loadingRoles ? "Loading roles..." : "Select role"} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-sm text-red-600 mt-1">{errors.role}</p>}
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
