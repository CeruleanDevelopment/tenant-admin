"use client"

import Link from "next/link"

export default function TenantUsersPage() {
  return (
    <main className="p-0">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold">Tenant Users</h1>
        <p className="mb-4 text-sm text-muted-foreground">Tenant-only user management namespace.</p>

        <div className="flex gap-3">
          <Link href="/tenant/users/view" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            View Users
          </Link>
          <Link href="/tenant/users/add" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            Add User
          </Link>
        </div>
      </div>
    </main>
  )
}
