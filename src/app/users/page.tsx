"use client"

import Link from "next/link"

export default function UsersPage() {
  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Users</h1>

        <p className="mb-4 text-sm text-muted-foreground">This is a sample Users index page. Use the links below to visit sub-pages.</p>

        <div className="flex gap-3">
          <Link href="/users/view" className="rounded-lg border px-4 py-2 bg-white shadow-sm">
            View Users
          </Link>
          <Link href="/users/add" className="rounded-lg border px-4 py-2 bg-white shadow-sm">
            Add User
          </Link>
        </div>
      </div>
    </main>
  )
}
