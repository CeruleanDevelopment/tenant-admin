import "./globals.css"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/sonner"
import AppShell from "./AppShell"
import PageMetadata from "./PageMetadata"
import { buildPageMeta } from "./page-meta"

export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get("x-pathname") || "/"
  return buildPageMeta(pathname)
}

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            <PageMetadata />
            <AppShell>{children}</AppShell>
            <Toaster position="top-right" richColors closeButton />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
