"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AgentsPage() {
  return (
    <main className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-2xl font-bold">Agents</h1>

        <Card className="rounded-2xl">
          {/* <CardHeader>
            <CardTitle>Agents</CardTitle>
          </CardHeader> */}
          <CardContent className="space-y-3 p-6">
            <div className="">
              <Button asChild>
                <Link href="/">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
