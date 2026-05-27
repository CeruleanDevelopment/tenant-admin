"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AgentsPage() {
  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold">Agents</h1>

        <Card className="rounded-2xl border-primary/15 shadow-sm">
          {/* <CardHeader>
            <CardTitle>Agents</CardTitle>
          </CardHeader> */}
          <CardContent className="space-y-3 p-6">
            <div className="flex flex-wrap gap-2">
              <Button asChild className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary-light">
                <Link href="/" prefetch={false}>Go to Dashboard</Link>
              </Button>
               <Button asChild variant="outline" className="cursor-pointer border-primary/20 text-primary hover:bg-primary/5 hover:text-primary">
                <Link href="/users/agents/chat" prefetch={false}>Open Agent Chatbot</Link>
              </Button>
              <Button asChild variant="outline" className="cursor-pointer border-primary/20 text-primary hover:bg-primary/5 hover:text-primary">
                <Link href="/users/agents/chat/modern" prefetch={false}>Open Agent Chatbot</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
