"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  fetchTenantAgentsOverview,
  setTenantAgentActive,
  updateTenantRoleMembers,
  updateTenantRoleUserActions,
  updateTenantUserActions,
  type TenantAgentOverview,
  type TenantOverviewUser,
} from "../../../../../actions/auth"
import type { AppDispatch } from "../../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAutoDismissApiMessage } from "@/hooks/useAutoDismissApiMessage"

type DialogTab = "roles" | "users"

const toggleId = (list: string[], id: string, checked: boolean): string[] =>
  checked ? Array.from(new Set([...list, id])) : list.filter((item) => item !== id)

const errorMessage = (error: unknown, fallback: string): string =>
  typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: string }).message || fallback)
    : fallback

const initials = (name: string, email: string): string => {
  const source = (name || email || "?").trim()
  const parts = source.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

const AVATAR_TONES = [
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
]

const avatarTone = (seed: string): string => {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

function Avatar({ name, email }: { name: string; email: string }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(email || name)}`}>
      {initials(name, email)}
    </span>
  )
}

function UserIdentity({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} email={email} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{name || email}</p>
        {name ? <p className="truncate text-xs text-slate-500">{email}</p> : null}
      </div>
    </div>
  )
}

export default function TenantCreatedAgentsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [agents, setAgents] = useState<TenantAgentOverview[]>([])
  const [users, setUsers] = useState<TenantOverviewUser[]>([])
  const [loading, setLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState("")

  const [dialogAgentId, setDialogAgentId] = useState("")
  const [tab, setTab] = useState<DialogTab>("roles")
  const [saving, setSaving] = useState(false)
  const [dialogMessage, setDialogMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [userSearch, setUserSearch] = useState("")

  const [roleId, setRoleId] = useState("")
  const [roleUserId, setRoleUserId] = useState("")
  const [roleUserActionIds, setRoleUserActionIds] = useState<string[]>([])
  const [memberDraft, setMemberDraft] = useState<Record<string, boolean>>({})

  const [userId, setUserId] = useState("")
  const [directActionIds, setDirectActionIds] = useState<string[]>([])

  const dialogAgent = useMemo(() => agents.find((agent) => agent.id === dialogAgentId) || null, [agents, dialogAgentId])
  const selectedRole = dialogAgent?.roles.find((role) => role.id === roleId) || null
  const selectedUserAccess = dialogAgent?.userAccess.find((item) => item.id === userId) || null
  const selectedUser = users.find((user) => user.id === userId) || null

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(term))
  }, [users, userSearch])

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    try {
      const data = await dispatch(fetchTenantAgentsOverview())
      setAgents(data.agents)
      setUsers(data.users)
    } catch (error) {
      setAgents([])
      setPageError(errorMessage(error, "Failed to load agents."))
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  useAutoDismissApiMessage(pageError, () => setPageError(null))
  useAutoDismissApiMessage(dialogMessage, () => setDialogMessage(null))

  // Drafts are loaded from server data when a role/user is clicked, never carried over.
  const selectRole = (role: TenantAgentOverview["roles"][number] | null) => {
    setRoleId(role?.id || "")
    setRoleUserId("")
    setRoleUserActionIds([])
    setMemberDraft({})
    setDialogMessage(null)
  }

  const isRoleMember = (id: string): boolean =>
    memberDraft[id] ?? Boolean(selectedRole?.users.some((member) => String(member.id) === id))

  const toggleRoleMember = (id: string, checked: boolean) => {
    setMemberDraft((prev) => ({ ...prev, [id]: checked }))
    selectRoleUser(id)
  }

  const selectRoleUser = (id: string) => {
    setRoleUserId(id)
    const direct = dialogAgent?.userAccess.find((item) => item.id === id)?.directActionIds || []
    setRoleUserActionIds(Array.from(new Set([...(selectedRole?.userActions?.[id] || []), ...direct].map(String))))
    setDialogMessage(null)
  }

  const selectUser = (id: string, access?: TenantAgentOverview["userAccess"][number]) => {
    setUserId(id)
    setDirectActionIds(access ? access.directActionIds.map(String) : [])
    setDialogMessage(null)
  }

  const openDialog = (agent: TenantAgentOverview) => {
    setDialogAgentId(agent.id)
    setTab("roles")
    selectRole(null)
    selectUser("")
    setUserSearch("")
    setDialogMessage(null)
  }

  const toggleAgentActive = async (agent: TenantAgentOverview) => {
    setTogglingId(agent.id)
    setPageError(null)
    try {
      await dispatch(setTenantAgentActive(agent.id, !agent.isActive))
      setAgents((prev) => prev.map((item) => (item.id === agent.id ? { ...item, isActive: !agent.isActive } : item)))
    } catch (error) {
      setPageError(errorMessage(error, "Failed to update agent status."))
    } finally {
      setTogglingId("")
    }
  }

  const saveRoleAssignments = async () => {
    if (!dialogAgent || !selectedRole || !dialogAgent.connectorId) return
    setSaving(true)
    setDialogMessage(null)
    try {
      const memberIds = users.filter((user) => isRoleMember(user.id)).map((user) => user.id)
      await dispatch(updateTenantRoleMembers(selectedRole.id, memberIds))
      if (roleUserId && memberIds.includes(roleUserId)) {
        const actions = dialogAgent.availableActions
          .filter((action) => roleUserActionIds.includes(String(action.id)))
          .map((action) => ({ connectorId: action.connectorId, actionId: action.id }))
        await dispatch(updateTenantRoleUserActions(selectedRole.id, roleUserId, dialogAgent.connectorId, actions))
      }
      await loadAgents()
      setMemberDraft({})
      setDialogMessage({ type: "ok", text: "Role users and actions saved." })
    } catch (error) {
      setDialogMessage({ type: "error", text: errorMessage(error, "Failed to save role assignments.") })
    } finally {
      setSaving(false)
    }
  }

  const saveUserActions = async () => {
    if (!dialogAgent || !userId || !dialogAgent.connectorId) return
    setSaving(true)
    setDialogMessage(null)
    try {
      const actions = dialogAgent.availableActions
        .filter((action) => directActionIds.includes(String(action.id)))
        .map((action) => ({ connectorId: action.connectorId, actionId: action.id }))
      await dispatch(updateTenantUserActions(userId, dialogAgent.connectorId, actions))
      await loadAgents()
      setDialogMessage({ type: "ok", text: "User actions updated." })
    } catch (error) {
      setDialogMessage({ type: "error", text: errorMessage(error, "Failed to update user actions.") })
    } finally {
      setSaving(false)
    }
  }

  // Actions the user already receives through roles cannot be removed as direct grants.
  const roleDerivedIds = new Set(
    (selectedUserAccess?.actions || []).filter((action) => action.source.includes("role")).map((action) => String(action.id)),
  )

  // Role-wide actions apply only to users who are members of the selected role.
  const roleLockedIds = new Set(
    selectedRole?.users.some((member) => String(member.id) === roleUserId)
      ? selectedRole.actions.map((action) => String(action.id))
      : [],
  )

  const tabButton = (value: DialogTab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => { setTab(value); setDialogMessage(null) }}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
        tab === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{count}</span>
    </button>
  )

  const searchBox = (
    <Input
      value={userSearch}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUserSearch(event.target.value)}
      placeholder="Search by name or email"
      className="h-9 bg-white"
    />
  )

  const actionList = (
    checkedFor: (id: string) => boolean,
    onChange: (id: string, checked: boolean) => void,
    disabledFor?: (id: string) => boolean,
    assignedFor?: (id: string) => boolean,
  ) => (
    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
      {dialogAgent?.availableActions.length === 0 ? (
        <p className="text-sm text-slate-500">No actions available for this tool.</p>
      ) : null}
      {dialogAgent?.availableActions.map((action) => {
        const id = String(action.id)
        const disabled = disabledFor?.(id) || false
        const checked = checkedFor(id)
        return (
          <label
            key={id}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
              checked ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
            } ${disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value: boolean | "indeterminate") => onChange(id, value === true)}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{action.displayName || action.actionKey}</p>
              <p className="truncate text-xs text-slate-500">{action.actionKey}</p>
            </div>
            {disabled && checked ? (
              <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">via role</Badge>
            ) : assignedFor?.(id) ? (
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">assigned</Badge>
            ) : null}
          </label>
        )
      })}
    </div>
  )

  const footer = (summary: string, label: string, onSave: () => void, disabled: boolean) => (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3">
      <p className="text-sm text-slate-600">{summary}</p>
      <Button type="button" disabled={saving || disabled} onClick={onSave} className="cursor-pointer">
        {saving ? "Saving..." : label}
      </Button>
    </div>
  )

  return (
    <main className="p-0">
      <div className="container mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Created Agents</h1>
              <p className="mt-2 text-sm text-slate-600">Manage agent status, roles, users and allowed actions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/tenant/agents" prefetch={false}>
                <Button variant="outline" className="cursor-pointer">Back to Catalog</Button>
              </Link>
              <Link href="/tenant/agents/create" prefetch={false}>
                <Button className="cursor-pointer">Create New Agent</Button>
              </Link>
            </div>
          </div>
        </section>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Tenant Agent Inventory</CardTitle>
            <CardDescription>{agents.length} agents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pageError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{pageError}</div>
            ) : null}
            {loading ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
            {!loading && agents.length === 0 ? <p className="text-sm text-muted-foreground">No agents found.</p> : null}

            {agents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell className="font-medium text-slate-900">{agent.name}</TableCell>
                        <TableCell>{agent.connectorName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={agent.isActive ? "outline" : "destructive"}>{agent.isActive ? "active" : "inactive"}</Badge>
                        </TableCell>
                        <TableCell>{agent.aiProvider || "-"}</TableCell>
                        <TableCell className="max-w-52 truncate">{agent.aiModel || "-"}</TableCell>
                        <TableCell>{agent.roles.length}</TableCell>
                        <TableCell>{agent.userAccess.length}</TableCell>
                        <TableCell>{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="inline-flex h-8 items-center justify-center leading-none cursor-pointer"
                              onClick={() => openDialog(agent)}
                            >
                              <span className="relative top-px leading-none">View</span>
                            </Button>
                            <Button
                              type="button"
                              variant={agent.isActive ? "destructive" : "default"}
                              size="sm"
                              className="inline-flex h-8 items-center justify-center leading-none cursor-pointer"
                              disabled={togglingId === agent.id}
                              onClick={() => void toggleAgentActive(agent)}
                            >
                              <span className="relative top-px leading-none">{agent.isActive ? "Deactivate" : "Activate"}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={Boolean(dialogAgent)} onOpenChange={(open) => { if (!open) setDialogAgentId("") }}>
          <DialogContent className="flex h-[680px] max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-sky-50 px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <DialogTitle className="text-xl font-semibold text-slate-900">{dialogAgent?.name}</DialogTitle>
                {dialogAgent?.connectorName ? (
                  <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">{dialogAgent.connectorName}</Badge>
                ) : null}
                <Badge variant={dialogAgent?.isActive ? "outline" : "destructive"}>
                  {dialogAgent?.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <DialogDescription>Control who can use this agent and which actions they are allowed to run.</DialogDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: "Roles", value: dialogAgent?.roles.length || 0 },
                  { label: "Users with access", value: dialogAgent?.userAccess.length || 0 },
                  { label: "Available actions", value: dialogAgent?.availableActions.length || 0 },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
                    <span className="text-slate-500">{stat.label}</span>
                    <span className="font-semibold text-slate-900">{stat.value}</span>
                  </div>
                ))}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {tabButton("roles", "Role wise", dialogAgent?.roles.length || 0)}
                {tabButton("users", "User wise", users.length)}
              </div>

              {dialogMessage ? (
                <div className={`rounded-lg border px-3 py-2 text-sm ${dialogMessage.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                  {dialogMessage.text}
                </div>
              ) : null}

              {dialogAgent && tab === "roles" ? (
                dialogAgent.roles.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No roles for this agent.
                  </p>
                ) : (
                  <div className="grid h-[370px] gap-4 md:grid-cols-[220px_1fr]">
                    <div className="space-y-2 overflow-y-auto pr-1">
                      {dialogAgent.roles.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => selectRole(role)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                            role.id === roleId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                          }`}
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">{role.name}</p>
                        </button>
                      ))}
                    </div>

                    <div className="flex h-full min-h-0 flex-col gap-4">
                      {!selectedRole ? (
                        <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                          Select a role, then tick users to assign them and choose their actions.
                        </p>
                      ) : (
                        <>
                          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_1fr]">
                            <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Users ({users.filter((user) => isRoleMember(user.id)).length} assigned)
                              </p>
                              {searchBox}
                              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                                {filteredUsers.length === 0 ? <p className="text-sm text-slate-500">No users match.</p> : null}
                                {filteredUsers.map((user) => (
                                  <div
                                    key={user.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => selectRoleUser(user.id)}
                                    onKeyDown={(event) => { if (event.key === "Enter") selectRoleUser(user.id) }}
                                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                                      user.id === roleUserId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
                                    }`}
                                  >
                                    <span onClick={(event) => event.stopPropagation()}>
                                      <Checkbox
                                        checked={isRoleMember(user.id)}
                                        onCheckedChange={(value: boolean | "indeterminate") => toggleRoleMember(user.id, value === true)}
                                      />
                                    </span>
                                    <UserIdentity name={user.name} email={user.email} />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              {!roleUserId ? (
                                <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
                                  Select a user to view and assign actions.
                                </p>
                              ) : !isRoleMember(roleUserId) ? (
                                <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
                                  Tick the checkbox to assign this user to the role, then choose actions.
                                </p>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Actions for {users.find((user) => user.id === roleUserId)?.name || "user"} ({roleUserActionIds.length + roleLockedIds.size})
                                  </p>
                                  {actionList(
                                    (id) => roleLockedIds.has(id) || roleUserActionIds.includes(id),
                                    (id, checked) => setRoleUserActionIds((prev) => toggleId(prev, id, checked)),
                                    (id) => roleLockedIds.has(id),
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              ) : null}

              {dialogAgent && tab === "users" ? (
                users.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No users found.
                  </p>
                ) : (
                  <div className="grid h-[370px] gap-4 md:grid-cols-[280px_1fr]">
                    <div className="flex min-h-0 flex-col gap-2">
                      {searchBox}
                      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                        {filteredUsers.map((user) => {
                          const access = dialogAgent.userAccess.find((item) => item.id === user.id)
                          return (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => selectUser(user.id, access)}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer ${
                                user.id === userId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <UserIdentity name={user.name} email={user.email} />
                              <Badge variant="outline" className="shrink-0">{access?.actions.length || 0}</Badge>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex h-full min-h-0 flex-col gap-4">
                      {selectedUser ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <UserIdentity name={selectedUser.name} email={selectedUser.email} />
                            <div className="flex flex-wrap items-center gap-1">
                              {(selectedUserAccess?.roles || []).length === 0 ? (
                                <span className="text-xs text-slate-500">No roles on this agent</span>
                              ) : (
                                selectedUserAccess?.roles.map((role) => (
                                  <Badge key={role.id} variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                                    {role.name}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <p className="text-sm font-semibold text-slate-900">Allowed actions</p>
                            {actionList(
                              (id) => roleDerivedIds.has(id) || directActionIds.includes(id),
                              (id, checked) => setDirectActionIds((prev) => toggleId(prev, id, checked)),
                              (id) => roleDerivedIds.has(id),
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                          Select a user to view actions.
                        </p>
                      )}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            {dialogAgent && tab === "roles" && selectedRole
              ? footer(
                  `${users.filter((user) => isRoleMember(user.id)).length} users assigned · ${roleUserActionIds.length} actions for selected user`,
                  "Save",
                  () => void saveRoleAssignments(),
                  !dialogAgent.connectorId,
                )
              : null}
            {dialogAgent && tab === "users" && selectedUser
              ? footer(
                  `${directActionIds.length + roleDerivedIds.size} actions selected`,
                  "Save User Actions",
                  () => void saveUserActions(),
                  !dialogAgent.connectorId,
                )
              : null}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
