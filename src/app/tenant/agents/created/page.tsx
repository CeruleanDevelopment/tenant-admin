"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  addTenantUser,
  fetchTenantAgentsOverview,
  fetchTenantUsers,
  saveTenantRole,
  saveTenantAgentToolBindings,
  setTenantAgentActive,
  updateTenantRoleActions,
  updateTenantRoleUserActions,
  updateTenantRoleMembers,
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

const MIN_SEARCH_CHARS = 3
const PAGE_SIZE = 10
const validateName = (value: string, label: string): string | undefined => {
  if (!value) return `${label} is required.`
  if (value.length < 2) return `${label} must be at least 2 characters.`
  if (value.length > 50) return `${label} must be at most 50 characters.`
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(value)) return `${label} can only contain letters, spaces, apostrophes, dots and hyphens.`
  return undefined
}

const validateEmail = (value: string): string | undefined => {
  if (!value) return "Email is required."
  if (value.length > 254) return "Email must be at most 254 characters."
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(value)) return "Enter a valid email address."
  return undefined
}

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
  const [page, setPage] = useState(1)
  const [dialogAgentId, setDialogAgentId] = useState("")
  const [tab, setTab] = useState<DialogTab>("roles")
  const [saving, setSaving] = useState(false)
  const [dialogMessage, setDialogMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState("")
  const [searchResults, setSearchResults] = useState<TenantOverviewUser[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [roleId, setRoleId] = useState("")
  const [roleUserId, setRoleUserId] = useState("")
  const [memberDraft, setMemberDraft] = useState<Record<string, boolean>>({})
  const [roleActionDraft, setRoleActionDraft] = useState<string[] | null>(null)
  const [roleUserDraft, setRoleUserDraft] = useState<Record<string, string[]>>({})

  const [userId, setUserId] = useState("")
  const [directActionIds, setDirectActionIds] = useState<string[]>([])

  const [addUserOpen, setAddUserOpen] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [addUserError, setAddUserError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ firstName: "", lastName: "", email: "", isActive: true })
  const [userFieldErrors, setUserFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({})

  const [addRoleOpen, setAddRoleOpen] = useState(false)
  const [addingRole, setAddingRole] = useState(false)
  const [addRoleError, setAddRoleError] = useState<string | null>(null)
  const [newRole, setNewRole] = useState({ name: "", description: "", isActive: true })

  const dialogAgent = useMemo(() => agents.find((agent) => agent.id === dialogAgentId) || null, [agents, dialogAgentId])
  const totalPages = Math.max(1, Math.ceil(agents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedAgents = agents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const selectedRole = dialogAgent?.roles.find((role) => role.id === roleId) || null
  const selectedUserAccess = dialogAgent?.userAccess.find((item) => item.id === userId) || null
  const searchTerm = userSearch.trim()
  const isSearchActive = searchTerm.length >= MIN_SEARCH_CHARS

  const allUsers = useMemo(() => {
    const byId = new Map<string, TenantOverviewUser>()
    for (const user of [...users, ...(searchResults || [])]) byId.set(user.id, user)
    return Array.from(byId.values())
  }, [users, searchResults])

  const selectedUser = allUsers.find((user) => user.id === userId) || null
  const filteredUsers = isSearchActive ? searchResults || [] : users

  useEffect(() => {
    if (!isSearchActive) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await dispatch(fetchTenantUsers({ search: searchTerm, limit: 50 }))
      if (cancelled) return
      setSearchResults(
        found.map((user) => ({
          id: String(user.id),
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim(),
          role: user.role,
          isActive: user.isActive !== false,
        })),
      )
      setSearching(false)
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [dispatch, isSearchActive, searchTerm])

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
  useAutoDismissApiMessage(addUserError, () => setAddUserError(null))
  useAutoDismissApiMessage(addRoleError, () => setAddRoleError(null))
  useAutoDismissApiMessage(dialogMessage, () => setDialogMessage(null))

  // Drafts are loaded from server data when a role/user is clicked, never carried over.
  const selectRole = (role: TenantAgentOverview["roles"][number] | null) => {
    setRoleId(role?.id || "")
    setRoleUserId("")
    setMemberDraft({})
    setRoleActionDraft(null)
    setRoleUserDraft({})
    setDialogMessage(null)
  }

  const isRoleMember = (id: string): boolean =>
    memberDraft[id] ?? Boolean(selectedRole?.users.some((member) => String(member.id) === id))

  const toggleRoleMember = (id: string, checked: boolean) => {
    setMemberDraft((prev) => ({ ...prev, [id]: checked }))
  }

  const selectRoleUser = (id: string) => {
    setRoleUserId((prev) => (prev === id ? "" : id))
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

  const submitNewUser = async () => {
    const firstName = newUser.firstName.trim()
    const lastName = newUser.lastName.trim()
    const email = newUser.email.trim().toLowerCase()
    const errors = {
      firstName: validateName(firstName, "First name"),
      lastName: validateName(lastName, "Last name"),
      email: validateEmail(email),
    }
    if (errors.firstName || errors.lastName || errors.email) {
      setUserFieldErrors(errors)
      return
    }
    setUserFieldErrors({})
    setAddingUser(true)
    setAddUserError(null)
    try {
      await dispatch(addTenantUser({
        email,
        firstName,
        lastName,
        isActive: newUser.isActive ? 1 : 0,
      }))
      await loadAgents()
      setAddUserOpen(false)
      setNewUser({ firstName: "", lastName: "", email: "", isActive: true })
      setDialogMessage({ type: "ok", text: "User added." })
    } catch (error) {
      const apiError = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      setAddUserError(apiError?.error || apiError?.message || errorMessage(error, "Failed to add user."))
    } finally {
      setAddingUser(false)
    }
  }

  const submitNewRole = async () => {
    const name = newRole.name.trim()
    if (!dialogAgent) return
    if (!name) {
      setAddRoleError("Role name is required.")
      return
    }
    setAddingRole(true)
    setAddRoleError(null)
    try {
      const saved = await dispatch(saveTenantRole({
        name,
        description: newRole.description.trim(),
        agentId: dialogAgent.id,
        connectorId: dialogAgent.connectorId || "",
        toolId: "",
        isActive: newRole.isActive ? 1 : 0,
        userIds: [],
        actions: [],
      }))
      await loadAgents()
      if (saved?.role?.id) setRoleId(String(saved.role.id))
      setAddRoleOpen(false)
      setNewRole({ name: "", description: "", isActive: true })
      setDialogMessage({ type: "ok", text: "Role added." })
    } catch (error) {
      const apiError = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data
      setAddRoleError(apiError?.error || apiError?.message || errorMessage(error, "Failed to add role."))
    } finally {
      setAddingRole(false)
    }
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

  // Agent tool allowlist = union of role actions, per-user role actions and direct user actions.
  const syncToolBindings = async (override: { roleId?: string; roleActionIds?: string[]; roleUserActions?: Record<string, string[]>; userId?: string; directIds?: string[] }) => {
    if (!dialogAgent || !dialogAgent.connectorId) return
    const ids = new Set<string>()
    for (const role of dialogAgent.roles) {
      const roleWide = role.id === override.roleId && override.roleActionIds ? override.roleActionIds : role.actions.map((action) => String(action.id))
      roleWide.forEach((id) => ids.add(String(id)))
      const perUser = role.id === override.roleId && override.roleUserActions ? { ...role.userActions, ...override.roleUserActions } : role.userActions || {}
      Object.values(perUser).forEach((list) => list.forEach((id) => ids.add(String(id))))
    }
    for (const access of dialogAgent.userAccess) {
      const direct = access.id === override.userId && override.directIds ? override.directIds : access.directActionIds
      direct.forEach((id) => ids.add(String(id)))
    }
    const actionKeys = dialogAgent.availableActions.filter((action) => ids.has(String(action.id))).map((action) => action.actionKey)
    await dispatch(saveTenantAgentToolBindings({ agentId: dialogAgent.id, connectorId: dialogAgent.connectorId, actionKeys }))
  }

  const saveRoleAssignments = async () => {
    if (!dialogAgent || !selectedRole || !dialogAgent.connectorId) return
    setSaving(true)
    setDialogMessage(null)
    try {
      const memberIds = allUsers.filter((user) => isRoleMember(user.id)).map((user) => user.id)
      if (roleActionDraft) {
        const roleActions = dialogAgent.availableActions
          .filter((action) => roleActionDraft.includes(String(action.id)))
          .map((action) => ({ connectorId: action.connectorId, actionId: action.id }))
        await dispatch(updateTenantRoleActions(selectedRole.id, roleActions))
      }
      await dispatch(updateTenantRoleMembers(selectedRole.id, memberIds))
      const perUser: Record<string, string[]> = {}
      for (const [uid, ids] of Object.entries(roleUserDraft)) {
        if (!memberIds.includes(uid)) continue
        const extra = ids.filter((id) => !roleLockedIds.has(id))
        perUser[uid] = extra
        const actions = dialogAgent.availableActions
          .filter((action) => extra.includes(String(action.id)))
          .map((action) => ({ connectorId: action.connectorId, actionId: action.id }))
        await dispatch(updateTenantRoleUserActions(selectedRole.id, uid, dialogAgent.connectorId, actions))
      }
      await syncToolBindings({ roleId: selectedRole.id, roleActionIds: roleActionDraft ?? undefined, roleUserActions: perUser })
      await loadAgents()
      setMemberDraft({})
      setRoleActionDraft(null)
      setRoleUserDraft({})
      setSaveResult("Role users and actions saved.")
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
      await syncToolBindings({ userId, directIds: directActionIds })
      await loadAgents()
      setSaveResult("User actions updated.")
    } catch (error) {
      setDialogMessage({ type: "error", text: errorMessage(error, "Failed to update user actions.") })
    } finally {
      setSaving(false)
    }
  }

  // Role-wide actions apply to every member of the selected role; edits stay in a draft until saved.
  const savedRoleActionIds = (selectedRole?.actions || []).map((action) => String(action.id))
  const roleLockedIds = new Set(roleActionDraft ?? savedRoleActionIds)

  // Actions the user receives through roles (including unsaved edits to the open role) cannot be edited as direct grants.
  const roleDerivedFor = (uid: string, skipOwnUserActions = false): Set<string> => {
    const ids = new Set<string>()
    if (!uid) return ids
    for (const role of dialogAgent?.roles || []) {
      const isOpenRole = role.id === roleId
      const isMember = isOpenRole ? isRoleMember(uid) : role.users.some((member) => String(member.id) === uid)
      if (!isMember) continue
      const roleWide = isOpenRole ? Array.from(roleLockedIds) : role.actions.map((action) => String(action.id))
      roleWide.forEach((id) => ids.add(id))
      ;(skipOwnUserActions && isOpenRole ? [] : role.userActions?.[uid] || []).forEach((id) => ids.add(String(id)))
    }
    return ids
  }
  const roleDerivedIds = roleDerivedFor(userId)

  // Everything a user ends up with on this agent: role-derived plus saved direct grants.
  const roleTabUser = allUsers.find((user) => user.id === roleUserId)
  const roleTabUserIds = roleDerivedFor(roleUserId, true)
  // Same user open in the Users tab: show its current (possibly unsaved) direct picks.
  const roleTabDirectIds =
    roleUserId === userId
      ? directActionIds
      : dialogAgent?.userAccess.find((item) => item.id === roleUserId)?.directActionIds || []
  roleTabDirectIds.forEach((id) => roleTabUserIds.add(String(id)))
  // Server-side effective actions, except this role's own per-user grants (those follow the draft).
  const ownSaved = new Set((selectedRole?.userActions?.[roleUserId] || []).map(String))
  dialogAgent?.userAccess
    .find((item) => item.id === roleUserId)
    ?.actions.forEach((action) => {
      const id = String(action.id)
      if (roleUserId !== userId && (action.source.includes("direct") || !ownSaved.has(id))) roleTabUserIds.add(id)
    })
  const roleTabOwnIds = roleUserDraft[roleUserId] ?? (selectedRole?.userActions?.[roleUserId] || []).map(String)
  roleTabOwnIds.forEach((id) => roleTabUserIds.add(id))
  const changeRoleUserAction = (id: string, checked: boolean) => {
    if (roleLockedIds.has(id)) return
    setRoleUserDraft((prev) => ({ ...prev, [roleUserId]: toggleId(roleTabOwnIds, id, checked) }))
    if (checked && !isRoleMember(roleUserId)) toggleRoleMember(roleUserId, true)
  }

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
    <div className="space-y-1">
      <Input
        value={userSearch}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUserSearch(event.target.value)}
        placeholder={`Search by name or email (min ${MIN_SEARCH_CHARS} characters)`}
        className="h-9 bg-white"
      />
      {searchTerm && !isSearchActive ? (
        <p className="text-xs text-slate-500">Type at least {MIN_SEARCH_CHARS} characters to search.</p>
      ) : null}
      {searching ? <p className="text-xs text-slate-500">Searching...</p> : null}
    </div>
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
            {/* {disabled && checked ? (
              <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">via role</Badge>
            ) : assignedFor?.(id) ? (
              <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">assigned</Badge>
            ) : null} */}
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
              <h1 className="text-2xl font-bold text-slate-900">Create Agent</h1>
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
            <CardTitle>Agents</CardTitle>
            {/* <CardDescription>{agents.length} agents</CardDescription> */}
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
                    {pagedAgents.map((agent) => (
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
                              className="inline-flex h-8 items-center justify-center leading-none cursor-pointer bg-primary text-white"
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
                {agents.length > PAGE_SIZE ? (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                    <p className="text-sm text-slate-600">
                      {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, agents.length)} of {agents.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                        Previous
                      </Button>
                      <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Dialog open={Boolean(dialogAgent)} onOpenChange={(open) => { if (!open) setDialogAgentId("") }}>
          <DialogContent className="flex h-170 max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
            <DialogHeader className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-sky-50 px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <DialogTitle className="text-xl font-semibold text-slate-900">{dialogAgent?.name}</DialogTitle>
                {dialogAgent?.connectorName ? (
                  <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">{dialogAgent.connectorName}</Badge>
                ) : null}
                {/* <Badge variant={dialogAgent?.isActive ? "outline" : "destructive"}>
                  {dialogAgent?.isActive ? "active" : "inactive"}
                </Badge> */}
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
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  {tabButton("roles", "Teams", dialogAgent?.roles.length || 0)}
                  {tabButton("users", "User", users.length)}
                </div>
                <div className="flex items-center gap-2">
                  {tab === "roles" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="inline-flex h-8 items-center justify-center px-4 leading-none cursor-pointer"
                      onClick={() => { setAddRoleError(null); setAddRoleOpen(true) }}
                    >
                      <span className="relative top-px leading-none">Add Role</span>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="inline-flex h-8 items-center justify-center px-4 leading-none cursor-pointer"
                    onClick={() => { setAddUserError(null); setUserFieldErrors({}); setAddUserOpen(true) }}
                  >
                    <span className="relative top-px leading-none">Add User</span>
                  </Button>
                </div>
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
                  <div className="grid h-92.5 gap-4 md:grid-cols-[220px_1fr]">
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
                          Select a role, then tick users to assign them and choose the role actions.
                        </p>
                      ) : (
                        <>
                          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_1fr]">
                            <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                              <p className="text-sm font-semibold text-slate-900">
                                Users ({allUsers.filter((user) => isRoleMember(user.id)).length} assigned)
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
                              {roleUserId && roleTabUser ? (
                                <>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-slate-900">
                                      Actions for {roleTabUser.name || roleTabUser.email} ({roleTabUserIds.size})
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setRoleUserId("")}
                                      className="cursor-pointer text-xs text-sky-700 hover:underline"
                                    >
                                      Edit role actions
                                    </button>
                                  </div>
                                  {actionList((id) => roleTabUserIds.has(id), changeRoleUserAction)}
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Role actions ({roleLockedIds.size}) - apply to all users in this role
                                  </p>
                                  {actionList(
                                    (id) => roleLockedIds.has(id),
                                    (id, checked) => setRoleActionDraft(toggleId(Array.from(roleLockedIds), id, checked)),
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
                  <div className="grid h-92.5 gap-4 md:grid-cols-[280px_1fr]">
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
                              (id) => directActionIds.includes(id),
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <p className="text-sm font-semibold text-slate-900">All actions</p>
                          {actionList(() => false, () => {}, () => true)}
                          <p className="text-xs text-slate-500">Select a user to view and assign actions.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : null}
            </div>

            {dialogAgent && tab === "roles" && selectedRole
              ? footer(
                  `${allUsers.filter((user) => isRoleMember(user.id)).length} users assigned · ${roleLockedIds.size} role actions`,
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

        <Dialog open={saveResult !== null} onOpenChange={(open) => { if (!open) { setSaveResult(null); setDialogAgentId("") } }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Saved</DialogTitle>
              <DialogDescription>{saveResult}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button type="button" onClick={() => { setSaveResult(null); setDialogAgentId("") }}>OK</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={addRoleOpen} onOpenChange={(open) => { if (!addingRole) setAddRoleOpen(open) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Add Role</DialogTitle>
              {/* <DialogDescription>Create a role for {dialogAgent?.name || "this agent"}.</DialogDescription> */}
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => { event.preventDefault(); void submitNewRole() }}
            >
              <div className="grid gap-2">
                <Label htmlFor="new-role-name">Role name</Label>
                <Input
                  id="new-role-name"
                  value={newRole.name}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewRole((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              {/* <div className="grid gap-2">
                <Label htmlFor="new-role-description">Description</Label>
                <Input
                  id="new-role-description"
                  value={newRole.description}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewRole((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div> */}
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">Active</p>
                <Switch
                  checked={newRole.isActive}
                  size="md"
                  onCheckedChange={(value: boolean) => setNewRole((prev) => ({ ...prev, isActive: Boolean(value) }))}
                />
              </div>
              {addRoleError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{addRoleError}</div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={addingRole} onClick={() => setAddRoleOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={addingRole || !newRole.name.trim()} className="cursor-pointer">
                  {addingRole ? "Adding..." : "Add Role"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={addUserOpen} onOpenChange={(open) => { if (!addingUser) setAddUserOpen(open) }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Add User</DialogTitle>
              {/* <DialogDescription>The user is added to your tenant and listed immediately.</DialogDescription> */}
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(event) => { event.preventDefault(); void submitNewUser() }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new-user-first">First name</Label>
                  <Input
                    id="new-user-first"
                    maxLength={50}
                    aria-invalid={Boolean(userFieldErrors.firstName)}
                    value={newUser.firstName}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setNewUser((prev) => ({ ...prev, firstName: event.target.value }))
                      setUserFieldErrors((prev) => ({ ...prev, firstName: undefined }))
                    }}
                  />
                  {userFieldErrors.firstName ? <p className="text-xs text-red-600">{userFieldErrors.firstName}</p> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-user-last">Last name</Label>
                  <Input
                    id="new-user-last"
                    maxLength={50}
                    aria-invalid={Boolean(userFieldErrors.lastName)}
                    value={newUser.lastName}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setNewUser((prev) => ({ ...prev, lastName: event.target.value }))
                      setUserFieldErrors((prev) => ({ ...prev, lastName: undefined }))
                    }}
                  />
                  {userFieldErrors.lastName ? <p className="text-xs text-red-600">{userFieldErrors.lastName}</p> : null}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input
                  id="new-user-email"
                  type="email"
                  maxLength={254}
                  aria-invalid={Boolean(userFieldErrors.email)}
                  value={newUser.email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setNewUser((prev) => ({ ...prev, email: event.target.value }))
                    setUserFieldErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                />
                {userFieldErrors.email ? <p className="text-xs text-red-600">{userFieldErrors.email}</p> : null}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">Active</p>
                <Switch
                  checked={newUser.isActive}
                  size="md"
                  onCheckedChange={(value: boolean) => setNewUser((prev) => ({ ...prev, isActive: Boolean(value) }))}
                />
              </div>
              {addUserError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{addUserError}</div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={addingUser} onClick={() => setAddUserOpen(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={addingUser} className="cursor-pointer">
                  {addingUser ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
