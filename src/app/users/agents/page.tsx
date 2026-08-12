"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import type { AppDispatch } from "../../../../redux/store"
import { fetchAssignedAgents } from "../../../../actions/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AssignedAgent = {
  id: string
  tenantId?: string
  name: string
  description: string
  status: string
  isActive: 0 | 1
  type: string
  aiProvider: string
  aiModel: string
  canRun: boolean
}

export default function UserAssignedAgentsPage() {
  const [agents, setAgents] = useState<AssignedAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter() as { push: (href: string) => void }
  // Load assigned agents on mount using the thunk via `dispatch`.
  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Dispatch the thunk and await its result. Cast to `any` so TypeScript
        // doesn't block the thunk-return value (redux-thunk typing).
        const rows = (await dispatch(fetchAssignedAgents() as any)) as unknown[]
        if (!mounted) return
        setAgents(Array.isArray(rows) ? (rows as AssignedAgent[]) : [])
      } catch (err: unknown) {
        if (!mounted) return
        const message =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message?: string }).message || "Failed to load assigned agents")
            : "Failed to load assigned agents"
        setError(message)
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [dispatch])

  return (
    <main className="p-0">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My Assigned Agents</h1>
            <p className="text-sm text-muted-foreground">
              These are tenant-assigned agents.
            </p>
          </div>
          {/* <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/users/signin" prefetch={false}>Switch User</Link>
          </Button> */}
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading assigned agents...</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && !error && agents.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No agents assigned yet. Ask your tenant admin to assign an agent.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id} className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={agent.isActive === 1 ? "outline" : "destructive"}>
                    {agent.isActive === 1 ? "active (1)" : "inactive (0)"}
                  </Badge>
                  <Badge variant="outline">{agent.aiProvider}</Badge>
                  <Badge variant="outline">{agent.aiModel}</Badge>
                </div>

                <div className="rounded-md border bg-muted/40 p-3 text-sm">Permission: {agent.canRun ? "Run allowed" : "View only"}</div>

                <Button
                  type="button"
                  className="w-full cursor-pointer"
                  disabled={agent.isActive === 0 || !agent.canRun}
                  onClick={() => {
                    if (!agent.canRun) return
                    if (agent.isActive === 0) return
                    router.push(`/users/agents/chat?agentId=${encodeURIComponent(agent.id)}`)
                  }}
                >
                  {agent.isActive === 0
                    ? "Agent Inactive"
                    : agent.canRun
                      ? "Run Agent"
                      : "No Run Permission"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
