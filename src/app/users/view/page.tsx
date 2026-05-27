"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "../../../../redux/store"
import { fetchTenantUsers, setTenantUserActiveStatus } from "../../../../actions/auth"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

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
      // dispatch returns the thunk's return value (a Promise); await directly instead
      const p = dispatch(fetchTenantUsers()) as Promise<unknown>
      p.then((res: unknown) => {
        if (!mounted) return
        const payload = Array.isArray(res) ? (res as UserRow[]) : []
        setUsers(payload)
        try {
          saveToCache(payload)
        } catch {
          // ignore
        }
      })
        .catch((err: unknown) => {
          if (!mounted) return
          console.error("Failed to fetch tenant users:", err)
          const em = typeof err === "object" && err !== null ? (err as { message?: string }).message : undefined
          setError(typeof em === "string" ? em : "Failed to load users")
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
  const total = sortedUsers.length
  const pagedUsers = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sortedUsers.slice(start, start + PAGE_SIZE)
  }, [currentPage, sortedUsers])

  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const to = total === 0 ? 0 : Math.min(total, currentPage * PAGE_SIZE)
  const visiblePages = Array.from({ length: totalPages }).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))

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

  const handleToggleActive = async (user: UserRow | UserTableRow, next: boolean) => {
    const userId = String(user.id || "")
    if (!userId) return

    setUpdatingById((prev) => ({ ...prev, [userId]: true }))
    setError(null)
    try {
      const resp = await dispatch(setTenantUserActiveStatus({ userId, isActive: next }))
      const updated = (typeof resp === "object" && resp !== null && "user" in (resp as object)) ? (resp as { user?: unknown }).user as Partial<UserRow> | null : null

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
    } catch (err: unknown) {
      console.error("Failed to update user active status:", err)
      const em = typeof err === "object" && err !== null ? (err as { message?: string }).message : undefined
      setError(typeof em === "string" ? em : "Failed to update user status")
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
                        <TableHead>Created</TableHead>
                        <TableHead className="w-55 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {pagedUsers.map((user) => {
                        const busy = Boolean(updatingById[user.id])

                        return (
                          <TableRow key={user.id} className="transition hover:bg-muted/40">
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.role}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={user.isActive ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}
                              >
                                {user.isActive === null || typeof user.isActive === "undefined" ? "-" : user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</TableCell>
                            <TableCell className="w-55 align-middle text-right">
                              <div className="ml-auto flex h-9 min-w-50 items-center justify-end gap-2 whitespace-nowrap">
                                <Switch
                                  size="default"
                                  checked={Boolean(user.isActive)}
                                  disabled={busy}
                                  onCheckedChange={(checked) => void handleToggleActive(user, Boolean(checked))}
                                  aria-label={`Toggle user ${user.name} status`}
                                  className="h-9 w-12 cursor-pointer"
                                />
                                <span className="text-sm text-muted-foreground">{user.isActive ? "Active" : "Inactive"}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Result {from}–{to} of {total}</span>

                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1) }} />
                      </PaginationItem>
                      {visiblePages.map((_, i) => {
                        const p = i + Math.max(1, page - 2)
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p) }}>{p}</PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      <PaginationItem>
                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1) }} />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
