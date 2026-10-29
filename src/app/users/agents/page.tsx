"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import { Bot, Loader2, Play } from "lucide-react"
import type { AppDispatch } from "../../../../redux/store"
import { fetchAssignedAgents } from "../../../../actions/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAutoDismissApiMessage } from "../../../hooks/useAutoDismissApiMessage"

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
  roles?: string[]
  allowedActions?: Array<{ actionKey: string; displayName: string; sources: string[] }>
}

export default function UserAssignedAgentsPage() {
  const [agents, setAgents] = useState<AssignedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useAutoDismissApiMessage(error, () => setError(null))

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter() as { push: (href: string) => void }
  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
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
      <div className="container mx-auto space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Agents</h1>
            <p className="mt-1 text-sm text-muted-foreground">Agents your tenant admin has assigned to you.</p>
          </div>
        </div>

        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading agents...
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {!loading && !error && agents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-12 text-center">
            <Bot className="size-10 text-muted-foreground" />
            <p className="font-medium">No agents to display</p>
            <p className="text-sm text-muted-foreground">You have no assigned agents yet.</p>
          </div>
        ) : null}

        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((agent) => {
            const disabled = agent.isActive === 0 || !agent.canRun
            return (
              <Card key={agent.id} className="group flex h-full flex-col items-center gap-0 rounded-2xl py-0 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <CardHeader className="flex w-full flex-col items-center gap-3 px-5 pb-2 pt-8">
                  <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Bot className="size-8" />
                  </div>
                  <CardTitle className="line-clamp-2 text-base font-semibold">{agent.name}</CardTitle>
                  <Badge variant={agent.isActive === 1 ? "default" : "secondary"} className="rounded-full px-3">
                    {agent.isActive === 1 ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex w-full flex-1 flex-col justify-end p-5 pt-4">
                  <Button
                    type="button"
                    className="w-full cursor-pointer rounded-full"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return
                      router.push(`/users/agents/chat?agentId=${encodeURIComponent(agent.id)}`)
                    }}
                  >
                    {agent.isActive === 0 ? (
                      "Agent Inactive"
                    ) : agent.canRun ? (
                      <>
                        <Play className="size-4" /> Run Agent
                      </>
                    ) : (
                      "No Run Permission"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}
