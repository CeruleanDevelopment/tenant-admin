import "./globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/sonner"
import AppShell from "./AppShell"

export const metadata = {
  title: {
    default: "PulseUI Pro – Modern Next.js Admin & Dashboard Template (ShadCN UI + Tailwind CSS)",
    template: "%s | PulseUI Pro",
  },
  description:
    "PulseUI Pro is a premium Next.js admin dashboard template built with ShadCN UI, Tailwind CSS, and TypeScript. Ideal for SaaS apps, CRM systems, analytics dashboards, and modern web applications.",
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
            <AppShell>{children}</AppShell>
            <Toaster position="top-right" richColors closeButton />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}