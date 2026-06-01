"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import axios from "@/service/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Row = {
  id: string
  message_id?: string | null
  created_at: string
  title?: string | null
  user_id?: string | null
  user_email?: string | null
}

export default function AgentConversationsPage() {
  const params = useParams() as { agentId?: string }
  const router = useRouter()
  const agentId = params.agentId || ""

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [userEmail, setUserEmail] = useState("")
  const [q, setQ] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchConversations = async (opts?: { page?: number; limit?: number }) => {
    if (!agentId) return
    setLoading(true)
    setError(null)
    try {
      const resp = await axios.get(`/ai/agents/${encodeURIComponent(agentId)}/conversations`, {
        params: {
          page: opts?.page || page,
          limit: opts?.limit || limit,
          userEmail: userEmail || undefined,
          q: q || undefined,
        },
      })

      const data = resp?.data || {}
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setTotal(Number(data.total || 0))
      setPage(Number(data.page || page))
      setLimit(Number(data.limit || limit))
    } catch (err: unknown) {
      setError("Failed to load conversations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchConversations({ page, limit })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, page, limit])

  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Agent Conversations</h1>
          <div>
            <Button variant="outline" onClick={() => router.back()}>Back</Button>
          </div>
        </div>

        {loading ? <p>Loading...</p> : null}
        {error ? <p className="text-rose-600">{error}</p> : null}

        <div className="mb-4 flex items-center gap-2">
          <input
            className="rounded-md border p-2"
            placeholder="Filter by user email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <input
            className="rounded-md border p-2"
            placeholder="Search id or title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button onClick={() => { setPage(1); void fetchConversations({ page: 1, limit }) }}>Apply</Button>
          <Button variant="outline" onClick={() => { setUserEmail(""); setQ(""); setPage(1); void fetchConversations({ page: 1, limit }) }}>Clear</Button>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingId === r.id ? (
                      <input className="border rounded p-1" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} />
                    ) : (
                      <span>{r.title || "New chat"}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{new Date(r.created_at).toLocaleString()}</Badge>
                  </div>
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">User: {r.user_email || r.user_id || "unknown"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button onClick={() => router.push(`/users/agents/chat?agentId=${encodeURIComponent(agentId)}&chatId=${encodeURIComponent(r.id)}`)}>Open Chat</Button>
                  {editingId === r.id ? (
                    <>
                      <Button
                        onClick={async () => {
                          setSaving(true)
                          try {
                            await axios.patch(`/ai/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(r.id)}`, { title: editingTitle })
                            setEditingId(null)
                            setEditingTitle("")
                            void fetchConversations({ page, limit })
                          } catch {
                            // ignore error
                          } finally {
                            setSaving(false)
                          }
                        }}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button variant="outline" onClick={() => { setEditingId(null); setEditingTitle("") }}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => { setEditingId(r.id); setEditingTitle(r.title || "") }}>Edit Title</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button className="ml-2" disabled={page * limit >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
          <div className="text-sm text-muted-foreground">Page {page} — {total} results</div>
        </div>
      </div>
    </main>
  )
}
