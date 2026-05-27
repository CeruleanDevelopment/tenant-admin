"use client"

import Link from "next/link"

export default function UsersPage() {
  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Users</h1>

        <p className="mb-4 text-sm text-muted-foreground">This is a sample Users index page. Use the links below to visit sub-pages.</p>

        <div className="flex gap-3">
          <Link href="/users/view" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            View Users
          </Link>
          <Link href="/users/add" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            Add User
          </Link>
          <Link href="/users/agents" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            User Agents
          </Link>
          <Link href="/users/agents/chat" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            User Chatbot
          </Link>
          <Link href="/users/agents/chat/modern" prefetch={false} className="cursor-pointer rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-primary shadow-sm transition hover:bg-primary/10">
            User Chatbot
          </Link>
        </div>
      </div>
    </main>
  )
}
