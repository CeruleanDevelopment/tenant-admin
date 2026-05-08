
 import { TooltipProvider } from "@/components/ui/tooltip"
 import AdminLayout from "@/components/layout/admin-layout"
 import { Toaster } from "sonner"
export default function LayoutPages({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
        <AdminLayout>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
          />
        </AdminLayout>
    </TooltipProvider>
  )
}