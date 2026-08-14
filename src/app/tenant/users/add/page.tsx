"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useDispatch } from "react-redux"
import { AppDispatch } from "../../../../../redux/store"
import { addTenantUser, fetchTenantAgents, fetchTenantUsers, updateTenantUser } from "../../../../../actions/auth"

const roleOptions: Array<{ value: string; label: string }> = [
  { value: "tenant-admin", label: "Tenant Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "User" },
]

export default function AddUserPage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const editUserId = String(searchParams.get("userId") || "").trim()
  const isEditMode = Boolean(editUserId)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("")
  const [isActive, setIsActive] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState("")
  const [loadingUser, setLoadingUser] = useState(Boolean(editUserId))
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [agentOptions, setAgentOptions] = useState<Array<{ id: string; name: string }>>([])

  const roles = useMemo(() => {
    if (!role || roleOptions.some((option) => option.value === role)) {
      return roleOptions
    }

    return [...roleOptions, { value: role, label: role }]
  }, [role])
  const loadingRoles = false

  const parseAssignedAgentIds = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean)
    }

    if (typeof value === "string") {
      return value.split(",").map((item) => item.trim()).filter(Boolean)
    }

    return []
  }

  const assignedAgentIdsCsv = selectedAgentIds.join(",")
  const agentNameById = useMemo(
    () => new Map(agentOptions.map((agent) => [agent.id, agent.name])),
    [agentOptions],
  )

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId)
      }

      return [...prev, agentId]
    })
  }

  useEffect(() => {
    let mounted = true
    setLoadingAgents(true)

    const request = dispatch(fetchTenantAgents()) as Promise<unknown>
    request
      .then((rows: unknown) => {
        if (!mounted) return
        const list = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : []
        const mapped = list
          .map((row) => {
            const id = String(row.id || "").trim()
            if (!id) return null

            const name = String(row.name || row.agentName || "Untitled Agent").trim() || "Untitled Agent"
            const activeRaw = row.isActive
            const isActiveAgent = typeof activeRaw === "boolean" ? activeRaw : Number(activeRaw ?? 1) !== 0
            if (!isActiveAgent) return null

            return { id, name }
          })
          .filter((row): row is { id: string; name: string } => Boolean(row))

        const uniqueById = Array.from(new Map(mapped.map((item) => [item.id, item])).values())
        setAgentOptions(uniqueById)
      })
      .finally(() => {
        if (!mounted) return
        setLoadingAgents(false)
      })

    return () => {
      mounted = false
    }
  }, [dispatch])

  useEffect(() => {
    let mounted = true

    if (!isEditMode) {
      return () => {
        mounted = false
      }
    }

    setLoadingUser(true)
    setErrors({})
    setSuccess("")

    const request = dispatch(fetchTenantUsers()) as Promise<unknown>
    request
      .then((rows: unknown) => {
        if (!mounted) return
        const users = Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : []
        const target = users.find((user) => String(user.id || "") === editUserId)

        if (!target) {
          setErrors({ form: "User not found for editing." })
          return
        }

        setFirstName(String(target.firstName || "").trim())
        setLastName(String(target.lastName || "").trim())
        setEmail(String(target.email || "").trim())

        const roleValue = String(target.role || "")
          .trim()
          .toLowerCase()
          .replace(/[_\s]+/g, "-")
        setRole(roleValue)

        const activeRaw = target.isActive
        const active = typeof activeRaw === "boolean" ? activeRaw : Number(activeRaw ?? 0) === 1
        setIsActive(Boolean(active))

        const assigned = parseAssignedAgentIds(
          target.assignedAgentIds ?? target.assigned_agent_ids ?? target.agentIds,
        )
        setSelectedAgentIds(Array.from(new Set(assigned)))
      })
      .catch((err: unknown) => {
        if (!mounted) return
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message || "")
            : ""
        setErrors({ form: message || "Failed to load user details." })
      })
      .finally(() => {
        if (!mounted) return
        setLoadingUser(false)
      })

    return () => {
      mounted = false
    }
  }, [dispatch, editUserId, isEditMode])

  useEffect(() => {
    if (isEditMode) return

    setFirstName("")
    setLastName("")
    setEmail("")
    setRole("")
    setIsActive(false)
    setSelectedAgentIds([])
    setErrors({})
    setSuccess("")
    setLoadingUser(false)
  }, [isEditMode])

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
    if (!isEditMode && !email.trim()) {
      e.email = "Email is required"
    } else if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Enter a valid email"
    }
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

    const assignedAgentIds = assignedAgentIdsCsv

    try {
      const resp = isEditMode
        ? await dispatch(updateTenantUser({
          userId: editUserId,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          role: role || "user",
          isActive: isActive ? 1 : 0,
          assignedAgentIds,
        }))
        : await dispatch(addTenantUser({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          role: role || "user",
          isActive: isActive ? 1 : 0,
          assignedAgentIds,
        }))

      let message = isEditMode ? "User updated." : "User added."
      if (typeof resp === "object" && resp !== null) {
        const r = resp as { message?: string; user?: unknown }
        message = r.message ?? (r.user ? (isEditMode ? "User updated successfully." : "User added successfully.") : message)
      } else if (typeof resp === "string") {
        message = resp
      }
      setSuccess(String(message))

      if (!isEditMode) {
        setFirstName("")
        setLastName("")
        setEmail("")
        setRole("")
        setIsActive(false)
        setSelectedAgentIds([])
      }
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

  if (loadingAgents || (isEditMode && loadingUser)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    )
  }

  return (
    <main className="p-0">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">{isEditMode ? "Edit User" : "Add User"}</h1>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{isEditMode ? "Edit user details" : "Add a new user"}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUser && <div className="text-sm text-muted-foreground mb-3">Loading user details...</div>}
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
                    disabled={isEditMode}
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

              <section className="rounded-3xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-primary/5 p-5 space-y-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">Assign Agents</h2>
                    <p className="text-sm text-slate-600">Select one or more active agents by clicking their names.</p>
                  </div>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                    {selectedAgentIds.length} selected
                  </Badge>
                </div>

                <div className="rounded-2xl "> 
                  {/* border border-slate-200 bg-white/90 p-3 */}
                  <div className="max-h-72 overflow-y-auto pr-1">
                    {loadingAgents ? (
                      <p className="px-2 py-3 text-sm text-slate-500">Loading active agents...</p>
                    ) : agentOptions.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-slate-500">No active agents available.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {agentOptions.map((agent) => {
                          const selected = selectedAgentIds.includes(agent.id)
                          return (
                            <button
                              type="button"
                              key={agent.id}
                              onClick={() => toggleAgentSelection(agent.id)}
                              className={selected
                                ? "group rounded-lg border border-primary bg-primary/10 px-3 py-3 text-center transition hover:bg-primary/15"
                                : "group rounded-lg border border-slate-200 bg-white px-3 py-3 text-center transition hover:border-primary/40 hover:bg-primary/5"
                              }
                            >
                              <p className={selected ? "truncate text-sm font-semibold text-primary" : "truncate text-sm font-semibold text-slate-800"}>
                                {agent.name}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <Label htmlFor="assigned-agent-ids" className="mb-2 text-slate-700">Assigned Agent IDs (CSV)</Label>
                  <Input id="assigned-agent-ids" value={assignedAgentIdsCsv} readOnly placeholder="No agents selected" className="bg-slate-50" />
                </div> */}

                {/* {selectedAgentIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedAgentIds.map((id) => (
                      <Badge key={id} variant="outline" className="rounded-full border-primary/40 bg-primary/10 px-3 py-1 text-primary">
                        {agentNameById.get(id) || id}
                      </Badge>
                    ))}
                  </div>
                ) : null} */}
              </section>

              <div className="flex items-center justify-end gap-3">
                <Button type="submit" disabled={submitting || loadingUser} className="bg-primary py-4 px-4 cursor-pointer">
                  {submitting ? "Saving..." : isEditMode ? "Save Changes" : "Add User"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
