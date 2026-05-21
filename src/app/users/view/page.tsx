"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "../../../../redux/store"
import { fetchTenantUsers, setTenantUserActiveStatus } from "../../../../actions/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"

type UserRow = {
  id: string
  email: string
  name?: string
  firstName?: string | null
  lastName?: string | null
  role?: string
  isActive?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
}

type UserTableRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  isActive: boolean
  firstName?: string | null
  lastName?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

const statusBadgeClass = (status: string) =>
  status === "Active" ? "bg-green-500/10 text-green-600" : "bg-muted"

const PAGE_SIZE = 10

export default function ViewUsersPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [users, setUsers] = useState<Array<UserRow>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingById, setUpdatingById] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<"name" | "email" | "role" | "status">("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    // Use a short-lived localStorage cache to avoid refetching on every
    // client-side navigation. This reduces duplicate API calls while keeping
    // data reasonably fresh. For robust server-rendered data, prefer a
    // server component that fetches on the server.
    const CACHE_KEY = "tenant_users_cache_v1"
    const TTL_MS = 60 * 1000 // 1 minute

    const tryLoadFromCache = (): UserRow[] | null => {
      try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!parsed || !parsed.ts || !parsed.data) return null
        if (Date.now() - parsed.ts > TTL_MS) return null
        return Array.isArray(parsed.data) ? (parsed.data as UserRow[]) : null
      } catch {
        return null
      }
    }

    const saveToCache = (data: UserRow[]) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
      } catch {
        // ignore
      }
    }

    const cached = tryLoadFromCache()
    if (cached) {
      setUsers(cached)
      setLoading(false)
    } else {
      void dispatch(fetchTenantUsers() as any)
        .then((res: any) => {
          if (!mounted) return
          const payload = Array.isArray(res) ? (res as UserRow[]) : []
          setUsers(payload)
          try {
            saveToCache(payload)
          } catch {
            // ignore
          }
        })
      .catch((err: any) => {
        if (!mounted) return
        console.error("Failed to fetch tenant users:", err)
        setError(typeof err?.message === "string" ? err.message : "Failed to load users")
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })
    }

    return () => {
      mounted = false
    }
  }, [dispatch])

  const tableData = React.useMemo<UserTableRow[]>(() => {
    return users.map((u) => {
      const name = String(u.name || [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "-")
      const isActive = Boolean(u.isActive)

      return {
        id: String(u.id || ""),
        name,
        email: String(u.email || "-"),
        role: String(u.role || "-"),
        status: isActive ? "Active" : "Inactive",
        isActive,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        createdAt: u.createdAt ?? null,
        updatedAt: u.updatedAt ?? null,
      }
    })
  }, [users])

  const filteredUsers = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tableData

    return tableData.filter((user) => {
      const hay = `${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, tableData])

  const sortedUsers = React.useMemo(() => {
    const items = [...filteredUsers]

    items.sort((a, b) => {
      const va = String(a[sortKey] || "")
      const vb = String(b[sortKey] || "")
      const result = va.localeCompare(vb)
      return sortDir === "asc" ? result : -result
    })

    return items
  }, [filteredUsers, sortDir, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedUsers.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedUsers])

  React.useEffect(() => {
    setPage(1)
  }, [query, sortKey, sortDir])

  const toggleSort = (key: "name" | "email" | "role" | "status") => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(key)
    setSortDir("asc")
  }

  const handleToggleActive = async (user: UserRow, next: boolean) => {
    const userId = String(user.id || "")
    if (!userId) return

    setUpdatingById((prev) => ({ ...prev, [userId]: true }))
    setError(null)
    try {
      const resp = await dispatch(setTenantUserActiveStatus({ userId, isActive: next }) as any)
      const updated = (resp && resp.user) ? resp.user : null

      setUsers((prev) =>
        prev.map((u) => {
          if (String(u.id) !== userId) return u
          if (!updated) return { ...u, isActive: next }
          return {
            ...u,
            isActive: typeof updated.isActive === "boolean" ? updated.isActive : next,
            role: updated.role ?? u.role,
            firstName: updated.firstName ?? u.firstName,
            lastName: updated.lastName ?? u.lastName,
            updatedAt: updated.updatedAt ?? u.updatedAt,
          }
        }),
      )
    } catch (err: any) {
      console.error("Failed to update user active status:", err)
      setError(typeof err?.message === "string" ? err.message : "Failed to update user status")
    } finally {
      setUpdatingById((prev) => ({ ...prev, [userId]: false }))
    }
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">View Users</h1>
          <p className="text-sm text-muted-foreground">Advanced table layout with search, sorting, pagination, and active toggle actions.</p>
        </div>

        {/* <div className="w-full md:max-w-sm">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, role"
          />
        </div> */}

        {loading && <p>Loading users...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="rounded-2xl border bg-background p-4 shadow-sm">
            {sortedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                          Name
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")}>
                          Email
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("role")}>
                          Role
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                          Status
                        </TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {pagedUsers.map((user) => {
                        const busy = Boolean(updatingById[user.id])

                        return (
                          <TableRow key={user.id}>
                            <TableCell>{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.role}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusBadgeClass(user.status)}
                              >
                                {user.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  size="default"
                                  checked={user.isActive}
                                  disabled={busy}
                                  onCheckedChange={(checked) => void handleToggleActive(user as any, Boolean(checked))}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {busy ? "Updating..." : "Toggle"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {sortedUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
                    -{Math.min(currentPage * PAGE_SIZE, sortedUsers.length)} of {sortedUsers.length}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
