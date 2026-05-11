
import { TooltipProvider } from "../../components/ui/tooltip"
import AdminLayout from "../../components/layout/admin-layout"
export default function LayoutPages({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
        <AdminLayout>
          {children}
        </AdminLayout>
    </TooltipProvider>
  )
}