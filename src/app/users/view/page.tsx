"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import type { ColumnDef } from "@tanstack/react-table"
import type { AppDispatch } from "../../../../redux/store"
import { fetchTenantUsers, setTenantUserActiveStatus } from "../../../../actions/auth"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
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

export default function ViewUsersPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [users, setUsers] = useState<Array<UserRow>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingById, setUpdatingById] = useState<Record<string, boolean>>({})

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

  const columns = React.useMemo<ColumnDef<UserTableRow>[]>(() => [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "role",
      header: "Role",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={statusBadgeClass(row.original.status)}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const user = row.original
        const busy = Boolean(updatingById[user.id])

        return (
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
        )
      },
    },
  ], [handleToggleActive, updatingById])

  return (
    <main className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">View Users</h1>
          <p className="text-sm text-muted-foreground">Advanced table layout with search, sorting, pagination, and active toggle actions.</p>
        </div>

        {loading && <p>Loading users...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="rounded-2xl border bg-background p-4 shadow-sm">
            {tableData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <DataTable columns={columns} data={tableData} />
            )}
          </div>
        )}
      </div>
    </main>
  )
}
