"use client"

import Link from "next/link"
import { LayoutGrid, MessageSquareText } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function UserDashboardPage() {
  return (
    <main className="p-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold">User Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome. Open your assigned agents and start conversations from here.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/users/agents" prefetch={false}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                View Assigned Agents
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Assigned Agents</CardTitle>
              <CardDescription>Browse all agents your tenant admin assigned to you.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/users/agents" prefetch={false}>
                  Open Agents
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Quick Chat</CardTitle>
              <CardDescription>Pick an agent and start a new conversation instantly.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/users/agents" prefetch={false}>
                  <MessageSquareText className="mr-2 h-4 w-4" />
                  Start Chat
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
