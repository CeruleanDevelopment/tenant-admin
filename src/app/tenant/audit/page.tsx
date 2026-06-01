"use client"

import { useEffect, useState } from "react"
import api from "@/service/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TenantAuditPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    void (async () => {
      try {
        const resp = await api.get("/audit")
        if (!mounted) return
        setRows(Array.isArray(resp?.data?.audits) ? resp.data.audits : [])
      } catch (err) {
        if (!mounted) return
        setError("Failed to load audit trail")
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold mb-4">Tenant Audit Trail</h1>
        {loading ? <p>Loading...</p> : null}
        {error ? <p className="text-rose-600">{error}</p> : null}

        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={String(r.id || Math.random())}>
              <CardHeader>
                <CardTitle className="text-sm">{String(r.action || "")} — {String(r.entityType || "")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div><strong>Actor:</strong> {String(r.actorType || "")} / {String(r.actorId || "")}</div>
                  <div><strong>Entity ID:</strong> {String(r.entityId || "")}</div>
                  <div className="mt-2"><strong>Metadata:</strong>
                    <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(r.metadata || {}, null, 2)}</pre>
                  </div>
                  <div className="mt-2 text-xs">{String(r.created_at || "")}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
