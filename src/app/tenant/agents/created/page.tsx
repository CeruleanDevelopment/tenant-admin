"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch } from "react-redux"
import {
  fetchTenantAgentAssignments,
  fetchTenantAgents,
  fetchTenantUsers,
  updateTenantUser,
  upsertTenantAgentAssignment,
} from "../../../../../actions/auth"
import type { AppDispatch } from "../../../../../redux/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AgentCategory = "gmail" | "crm" | "support" | "calendar" | "knowledge" | "automation" | "general"

const roleOptions: Array<{ value: string; label: string }> = [
  { value: "tenant-admin", label: "Tenant Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "User" },
]

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  gmail: "Gmail",
  crm: "CRM",
  support: "Support",
  calendar: "Calendar",
  knowledge: "Knowledge",
  automation: "Automation",
  general: "General",
}

const CATEGORY_STYLE: Record<AgentCategory, string> = {
  gmail: "border-sky-300 bg-sky-50 text-sky-700",
  crm: "border-indigo-300 bg-indigo-50 text-indigo-700",
  support: "border-violet-300 bg-violet-50 text-violet-700",
  calendar: "border-cyan-300 bg-cyan-50 text-cyan-700",
  knowledge: "border-emerald-300 bg-emerald-50 text-emerald-700",
  automation: "border-orange-300 bg-orange-50 text-orange-700",
  general: "border-slate-300 bg-slate-50 text-slate-700",
}

type TenantAgentCard = {
  id: string
  name: string
  description: string
  category: AgentCategory
  configured: boolean
  isActive: 0 | 1
  aiProvider: "openai" | "openrouter"
  aiModel: string
  managerCanRun: boolean
  userCanRun: boolean
  assignedUserIds: string[]
  workflowType?: string
  createdAt?: string | null
}

type TenantUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  role?: string | null
  isActive?: boolean | null
  assignedAgentIds?: string | null
  assigned_agent_ids?: string | null
  agentIds?: string | null
}

const detectAgentCategory = (input: {
  name: string
  description: string
  systemPrompt?: string
  allowedCollections?: string[]
}): AgentCategory => {
  const blob = [
    input.name,
    input.description,
    input.systemPrompt || "",
    ...(input.allowedCollections || []),
  ]
    .join(" ")
    .toLowerCase()

  if (/gmail|email|inbox|thread/.test(blob)) return "gmail"
  if (/crm|salesforce|hubspot|lead|opportunity|pipeline|contact/.test(blob)) return "crm"
  if (/ticket|support|helpdesk|zendesk|service desk/.test(blob)) return "support"
  if (/calendar|meeting|schedule|appointment/.test(blob)) return "calendar"
  if (/knowledge|document|rag|embedding|search/.test(blob)) return "knowledge"
  if (/workflow|automation|trigger|approval/.test(blob)) return "automation"
  return "general"
}

const normalizeRoleValue = (value: unknown): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")

const getRoleLabel = (value: unknown): string => {
  const normalized = normalizeRoleValue(value)
  const matched = roleOptions.find((option) => option.value === normalized)
  return matched?.label || normalized || "User"
}

const STATUS_BADGE_CLASS = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
} as const

export default function TenantCreatedAgentsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [agents, setAgents] = useState<TenantAgentCard[]>([])
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [viewUsersModalOpen, setViewUsersModalOpen] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [viewAgent, setViewAgent] = useState<TenantAgentCard | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<TenantAgentCard | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedUserRoles, setSelectedUserRoles] = useState<Record<string, string>>({})
  const [userSearch, setUserSearch] = useState("")
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  const parseAssignedAgentIds = useCallback((value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean)
    }

    if (typeof value !== "string") {
      return []
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }, [])

  const getUserDisplayName = useCallback((user: TenantUser): string => {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
    return fullName || user.email || "Unknown user"
  }, [])

  const getUserInitials = useCallback((user: TenantUser): string => {
    const parts = [user.firstName, user.lastName].filter(Boolean).map((value) => String(value).trim())
    if (parts.length > 0) {
      return parts.slice(0, 2).map((value) => value.charAt(0).toUpperCase()).join("")
    }

    return String(user.email || "U").charAt(0).toUpperCase()
  }, [])

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true)
    setPageError(null)
    try {
      const rows = await (dispatch(fetchTenantAgents()) as Promise<Record<string, unknown>[]>)

      const assignmentMap = await (dispatch(fetchTenantAgentAssignments()) as Promise<Record<string, Record<string, unknown> | null>>)

      const mapped: Array<TenantAgentCard | null> = rows.map((row: Record<string, unknown>) => {
        const id = String(row.id || "")
        if (!id) return null

        const assignment = assignmentMap[id] || null

        return {
          id,
          name: String((assignment?.agentName as string) || row.name || "Untitled Agent"),
          description: String(row.description || ""),
          category: detectAgentCategory({
            name: String((assignment?.agentName as string) || row.name || "Untitled Agent"),
            description: String(row.description || ""),
            systemPrompt: String(row.systemPrompt || ""),
            allowedCollections: Array.isArray(row.allowedCollections)
              ? row.allowedCollections.map((value: unknown) => String(value))
              : [],
          }),
          configured: Boolean(assignment?.configured),
          isActive: Number((assignment?.isActive as number | undefined) ?? row.isActive ?? 1) === 0 ? 0 : 1,
          aiProvider: assignment?.aiProvider === "openrouter" ? "openrouter" : "openai",
          aiModel: String((assignment?.aiModel as string | undefined) || "gpt-4.1-mini"),
          managerCanRun: Boolean((assignment?.managerCanRun as boolean | undefined) ?? true),
          userCanRun: Boolean((assignment?.userCanRun as boolean | undefined) ?? (assignment?.memberCanRun as boolean | undefined) ?? false),
          assignedUserIds: Array.isArray(assignment?.assignedUserIds)
            ? assignment.assignedUserIds.map((value: unknown) => String(value))
            : [],
          workflowType: row.workflowType ? String(row.workflowType) : undefined,
          createdAt: row.createdAt ? String(row.createdAt) : null,
        } as TenantAgentCard
      })

      setAgents(mapped.filter((value): value is TenantAgentCard => Boolean(value)))
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message || "Failed to load agents.")
          : "Failed to load agents."
      setAgents([])
      setPageError(message)
    } finally {
      setLoadingAgents(false)
    }
  }, [dispatch])

  const loadTenantUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const rows = await (dispatch(fetchTenantUsers()) as Promise<Array<Record<string, unknown>>>)
      const mapped = Array.isArray(rows)
        ? rows
            .map((row) => {
              const id = String(row.id || "").trim()
              if (!id) return null

              return {
                id,
                email: String(row.email || "").trim(),
                firstName: row.firstName ? String(row.firstName) : null,
                lastName: row.lastName ? String(row.lastName) : null,
                role: row.role ? String(row.role) : null,
                isActive: typeof row.isActive === "boolean" ? row.isActive : null,
                assignedAgentIds: row.assignedAgentIds ? String(row.assignedAgentIds) : null,
                assigned_agent_ids: row.assigned_agent_ids ? String(row.assigned_agent_ids) : null,
                agentIds: row.agentIds ? String(row.agentIds) : null,
              } as TenantUser
            })
            .filter((row): row is TenantUser => Boolean(row))
        : []

      setTenantUsers(mapped)
    } catch {
      setTenantUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [dispatch])

  useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  useEffect(() => {
    void loadTenantUsers()
  }, [loadTenantUsers])

  const categoryCounts = useMemo(() => {
    return agents.reduce<Record<AgentCategory, number>>(
      (acc, agent) => {
        acc[agent.category] += 1
        return acc
      },
      {
        gmail: 0,
        crm: 0,
        support: 0,
        calendar: 0,
        knowledge: 0,
        automation: 0,
        general: 0,
      },
    )
  }, [agents])

  const getUsersAssignedToAgent = useCallback((agent: TenantAgentCard | null): TenantUser[] => {
    if (!agent) return []

    const explicitSet = new Set(agent.assignedUserIds)

    return tenantUsers.filter((user) => {
      if (explicitSet.has(user.id)) {
        return true
      }

      const assignedAgentIds = parseAssignedAgentIds(user.assignedAgentIds ?? user.assigned_agent_ids ?? user.agentIds)
      return assignedAgentIds.includes(agent.id)
    })
  }, [parseAssignedAgentIds, tenantUsers])

  const buildSearchText = useCallback((user: TenantUser): string => {
    return [getUserDisplayName(user), user.email, user.role || ""]
      .join(" ")
      .toLowerCase()
  }, [getUserDisplayName])

  const sortedTenantUsers = useMemo(() => {
    return [...tenantUsers].sort((left, right) => getUserDisplayName(left).localeCompare(getUserDisplayName(right)))
  }, [getUserDisplayName, tenantUsers])

  const openViewUsersModal = useCallback((agent: TenantAgentCard) => {
    setViewAgent(agent)
    setViewUsersModalOpen(true)
  }, [])

  const openAssignUsersModal = useCallback((agent: TenantAgentCard) => {
    const assignedUsers = getUsersAssignedToAgent(agent)
    const roleMap = tenantUsers.reduce<Record<string, string>>((acc, user) => {
      acc[user.id] = normalizeRoleValue(user.role) || "user"
      return acc
    }, {})
    setSelectedAgent(agent)
    setSelectedUserIds(Array.from(new Set(assignedUsers.map((user) => user.id))))
    setSelectedUserRoles(roleMap)
    setUserSearch("")
    setAssignmentError(null)
    setAssignmentModalOpen(true)
  }, [getUsersAssignedToAgent, tenantUsers])

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      }

      return [...prev, userId]
    })
  }, [])

  const handleRoleChange = useCallback((userId: string, role: string) => {
    setSelectedUserRoles((prev) => ({
      ...prev,
      [userId]: normalizeRoleValue(role) || "user",
    }))
  }, [])

  const handleSaveAssignments = useCallback(async () => {
    if (!selectedAgent) return

    setSavingAssignment(true)
    setAssignmentError(null)
    try {
      await (dispatch(
        upsertTenantAgentAssignment({
          agentId: selectedAgent.id,
          aiProvider: selectedAgent.aiProvider,
          aiModel: selectedAgent.aiModel,
          managerCanRun: selectedAgent.managerCanRun,
          userCanRun: selectedAgent.userCanRun,
          assignedUserIds: selectedUserIds,
        }),
      ) as Promise<unknown>)

      const usersWithRoleChanges = tenantUsers.filter((user) => {
        const nextRole = selectedUserRoles[user.id] || "user"
        return nextRole !== (normalizeRoleValue(user.role) || "user")
      })

      if (usersWithRoleChanges.length > 0) {
        await Promise.all(
          usersWithRoleChanges.map((user) =>
            dispatch(
              updateTenantUser({
                userId: user.id,
                role: selectedUserRoles[user.id] || "user",
              }),
            ) as Promise<unknown>,
          ),
        )
      }

      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.id !== selectedAgent.id) return agent
          return {
            ...agent,
            assignedUserIds: Array.from(new Set(selectedUserIds)),
          }
        }),
      )

      setTenantUsers((prev) =>
        prev.map((user) => {
          const existing = parseAssignedAgentIds(user.assignedAgentIds ?? user.assigned_agent_ids ?? user.agentIds)
          const hasAgent = existing.includes(selectedAgent.id)
          const shouldHaveAgent = selectedUserIds.includes(user.id)
          const nextRole = selectedUserRoles[user.id] || normalizeRoleValue(user.role) || "user"

          if (hasAgent === shouldHaveAgent && nextRole === (normalizeRoleValue(user.role) || "user")) {
            return user
          }

          const next = shouldHaveAgent
            ? [...existing, selectedAgent.id]
            : existing.filter((agentId) => agentId !== selectedAgent.id)

          return {
            ...user,
            role: nextRole,
            assignedAgentIds: Array.from(new Set(next)).join(","),
          }
        }),
      )

      setAssignmentModalOpen(false)
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: string }).message || "Failed to update assigned users.")
          : "Failed to update assigned users."
      setAssignmentError(message)
    } finally {
      setSavingAssignment(false)
    }
  }, [dispatch, parseAssignedAgentIds, selectedAgent, selectedUserIds, selectedUserRoles, tenantUsers])

  const assignedUsersForSelectedAgent = useMemo(() => {
    const selected = new Set(selectedUserIds)
    return sortedTenantUsers.filter((user) => selected.has(user.id))
  }, [selectedUserIds, sortedTenantUsers])

  const unassignedUsersForSelectedAgent = useMemo(() => {
    const selected = new Set(selectedUserIds)
    return sortedTenantUsers.filter((user) => !selected.has(user.id))
  }, [selectedUserIds, sortedTenantUsers])

  const viewAssignedUsers = useMemo(() => {
    return getUsersAssignedToAgent(viewAgent)
  }, [getUsersAssignedToAgent, viewAgent])

  const filteredAssignedUsersForSelectedAgent = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return assignedUsersForSelectedAgent
    return assignedUsersForSelectedAgent.filter((user) => buildSearchText(user).includes(query))
  }, [assignedUsersForSelectedAgent, buildSearchText, userSearch])

  const filteredUnassignedUsersForSelectedAgent = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return unassignedUsersForSelectedAgent
    return unassignedUsersForSelectedAgent.filter((user) => buildSearchText(user).includes(query))
  }, [buildSearchText, unassignedUsersForSelectedAgent, userSearch])

  const assignmentSummary = useMemo(() => {
    return {
      assignedCount: selectedUserIds.length,
      availableCount: Math.max(tenantUsers.length - selectedUserIds.length, 0),
      roleChanges: tenantUsers.filter((user) => {
        const nextRole = selectedUserRoles[user.id] || normalizeRoleValue(user.role) || "user"
        return nextRole !== (normalizeRoleValue(user.role) || "user")
      }).length,
    }
  }, [selectedUserIds, selectedUserRoles, tenantUsers])

  const renderAssignmentUserCard = useCallback((user: TenantUser, tone: "emerald" | "sky") => {
    const isSelected = selectedUserIds.includes(user.id)
    const roleValue = selectedUserRoles[user.id] || normalizeRoleValue(user.role) || "user"
    const roleChanged = roleValue !== (normalizeRoleValue(user.role) || "user")
    const accent = tone === "emerald"
      ? {
          shell: "border-emerald-200 bg-white hover:border-emerald-300",
          avatar: "bg-emerald-100 text-emerald-800",
          chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : {
          shell: "border-sky-200 bg-white hover:border-sky-300",
          avatar: "bg-sky-100 text-sky-800",
          chip: "border-sky-200 bg-sky-50 text-sky-700",
        }

    return (
      <label key={user.id} className={`block cursor-pointer rounded-2xl border px-4 py-4 shadow-sm transition ${accent.shell}`}>
        <div className="flex gap-3">
          <div className="pt-0.5">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleUserSelection(user.id)}
            />
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${accent.avatar}`}>
            {getUserInitials(user)}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">{getUserDisplayName(user)}</p>
                <Badge variant="outline" className={isSelected ? accent.chip : "border-slate-200 bg-slate-50 text-slate-700"}>
                  {isSelected ? "assigned" : "available"}
                </Badge>
                {roleChanged ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    role changed
                  </Badge>
                ) : null}
              </div>
              <p className="truncate text-xs text-slate-600">{user.email}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {getRoleLabel(roleValue)}
                </Badge>
                <Badge variant="outline" className={user.isActive ? STATUS_BADGE_CLASS.active : STATUS_BADGE_CLASS.inactive}>
                  {user.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Role</p>
                <Select
                  value={roleValue}
                  onValueChange={(value) => handleRoleChange(user.id, value)}
                  disabled={savingAssignment}
                >
                  <SelectTrigger className="h-9 w-full bg-white text-left">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </label>
    )
  }, [getUserDisplayName, getUserInitials, handleRoleChange, savingAssignment, selectedUserIds, selectedUserRoles, toggleUserSelection])

  const agentAssignedPreview = useCallback((agent: TenantAgentCard): string[] => {
    return getUsersAssignedToAgent(agent).slice(0, 2).map((user) => getUserDisplayName(user))
  }, [getUserDisplayName, getUsersAssignedToAgent])

  return (
    <main className="p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Created Agents</h1>
              <p className="mt-2 text-sm text-slate-600">All already-created tenant agents in one dedicated page.</p>
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
            <CardDescription>Configured and unconfigured agents with runtime details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pageError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {pageError}
              </div>
            ) : null}
            {loadingAgents ? <p className="text-sm text-muted-foreground">Loading agents...</p> : null}
            {!loadingAgents && agents.length === 0 ? <p className="text-sm text-muted-foreground">No agents found.</p> : null}

            {!loadingAgents && agents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-700 space-y-2">
                <p>
                  Showing <span className="font-semibold text-slate-900">{agents.length}</span> agents. Configured: <span className="font-semibold text-slate-900">{agents.filter((agent) => agent.configured).length}</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(categoryCounts) as AgentCategory[])
                    .filter((category) => categoryCounts[category] > 0)
                    .map((category) => (
                      <Badge key={category} variant="outline" className={CATEGORY_STYLE[category]}>
                        {CATEGORY_LABEL[category]}: {categoryCounts[category]}
                      </Badge>
                    ))}
                </div>
              </div>
            ) : null}

            {!loadingAgents && agents.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      {/* <TableHead>Assigned Users</TableHead> */}
                      <TableHead>Created</TableHead>
                      <TableHead className="">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agent) => (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{agent.name}</p>
                            {/* <p className="text-xs text-slate-500">{agent.description || "No description provided."}</p> */}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={CATEGORY_STYLE[agent.category]}>{CATEGORY_LABEL[agent.category]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                              {agent.isActive === 1 ? "active" : "inactive"}
                            </Badge>
                            {/* <Badge
                              variant="outline"
                              className={agent.configured ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"}
                            >
                              {agent.configured ? "configured" : "not configured"}
                            </Badge> */}
                          </div>
                        </TableCell>
                        <TableCell>{agent.aiProvider}</TableCell>
                        <TableCell className="max-w-52 truncate">{agent.aiModel}</TableCell>
                        {/* <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900">{getUsersAssignedToAgent(agent).length}</p>
                            {agentAssignedPreview(agent).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {agentAssignedPreview(agent).map((name) => (
                                  <Badge key={name} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No users assigned</p>
                            )}
                          </div>
                        </TableCell> */}
                        <TableCell>{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right align-middle">
                          <div className="flex items-stretch justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 min-w-28 cursor-pointer rounded-lg bg-primary px-4 text-sm font-medium text-white"
                              onClick={() => openViewUsersModal(agent)}
                            >
                              <span className="flex h-full items-center justify-center leading-none">View Users</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 min-w-28 cursor-pointer rounded-lg border-sky-200 bg-sky-50 px-4 text-sm font-medium text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                              onClick={() => openAssignUsersModal(agent)}
                            >
                              <span className="flex h-full items-center justify-center leading-none">Assign Users</span>
                            </Button>
                            {/* <Link href={`/tenant/agents/create?agentId=${encodeURIComponent(agent.id)}`} prefetch={false}>
                              <Button size="sm" className="cursor-pointer">Edit Agent</Button>
                            </Link> */}
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

        <Dialog open={viewUsersModalOpen} onOpenChange={setViewUsersModalOpen}>
          <DialogContent className="sm:max-w-2xl rounded-2xl border border-slate-200 bg-white p-0">
            <DialogHeader className="border-b border-slate-200 bg-linear-to-r from-slate-50 to-white px-6 py-5">
              <DialogTitle className="text-base font-semibold text-slate-900">Assigned Users</DialogTitle>
              <DialogDescription>
                {viewAgent ? `Users currently assigned to ${viewAgent.name}.` : "Assigned users for this agent."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{viewAgent?.name || "Agent"}</p>
                  <p className="text-xs text-slate-600">Assigned user count: {viewAssignedUsers.length}</p>
                </div>
                {viewAgent ? <Badge variant="outline" className={CATEGORY_STYLE[viewAgent.category]}>{CATEGORY_LABEL[viewAgent.category]}</Badge> : null}
              </div>

              {viewAssignedUsers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No users assigned yet</p>
                  <p className="mt-1 text-xs text-slate-500">Use the Assign Users button to attach tenant users to this agent.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {viewAssignedUsers.map((user) => (
                    <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          {getUserInitials(user)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{getUserDisplayName(user)}</p>
                          <p className="truncate text-xs text-slate-600">{user.email}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {getRoleLabel(user.role)}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={user.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}
                            >
                              {user.isActive ? "active" : "inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
          <DialogContent className="sm:max-w-5xl rounded-2xl border border-slate-200 bg-white p-0">
            <DialogHeader className="border-b border-slate-200 bg-linear-to-r from-sky-50 via-white to-slate-50 px-6 py-5">
              <DialogTitle className="text-base font-semibold text-slate-900">Assign Users</DialogTitle>
              <DialogDescription>
                {selectedAgent
                  ? `Choose which tenant users should be able to access ${selectedAgent.name}.`
                  : "Manage assigned users for this agent."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-6 py-5">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedAgent?.name || "Agent"}</p>
                  <p className="text-xs text-slate-600">Assigned: {selectedUserIds.length} of {tenantUsers.length} tenant users</p>
                </div>
                <div className="w-full lg:w-80">
                  <Input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search users by name, email, or role"
                    className="bg-white"
                  />
                </div>
              </div>

              {assignmentError ? <p className="text-sm text-red-600">{assignmentError}</p> : null}
              {loadingUsers ? <p className="text-sm text-slate-600">Loading tenant users...</p> : null}

              {!loadingUsers ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">Assigned Users</p>
                        <p className="text-xs text-emerald-700">Users who currently have this agent.</p>
                      </div>
                      <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-700">
                        {filteredAssignedUsersForSelectedAgent.length}
                      </Badge>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {filteredAssignedUsersForSelectedAgent.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-emerald-300 bg-white/70 px-4 py-6 text-center">
                          <p className="text-sm text-emerald-800">No assigned users match this filter.</p>
                        </div>
                      ) : (
                        filteredAssignedUsersForSelectedAgent.map((user) => renderAssignmentUserCard(user, "emerald"))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-sky-900">Available Tenant Users</p>
                        <p className="text-xs text-sky-700">Select users here to assign this agent.</p>
                      </div>
                      <Badge variant="outline" className="border-sky-300 bg-white text-sky-700">
                        {filteredUnassignedUsersForSelectedAgent.length}
                      </Badge>
                    </div>

                    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {filteredUnassignedUsersForSelectedAgent.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-sky-300 bg-white/70 px-4 py-6 text-center">
                          <p className="text-sm text-sky-800">No available users match this filter.</p>
                        </div>
                      ) : (
                        filteredUnassignedUsersForSelectedAgent.map((user) => renderAssignmentUserCard(user, "sky"))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <div className="mr-auto flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-3 py-1">Assigned: {assignmentSummary.assignedCount}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">Available: {assignmentSummary.availableCount}</span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Role changes: {assignmentSummary.roleChanges}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setAssignmentModalOpen(false)}
                  disabled={savingAssignment}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => void handleSaveAssignments()}
                  disabled={savingAssignment || !selectedAgent}
                >
                  {savingAssignment ? "Saving..." : "Save Assignments"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
