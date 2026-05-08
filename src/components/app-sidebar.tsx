"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSelector } from "react-redux"
import type { RootState } from "../../redux/reducers"
import { useDispatch } from "react-redux"
import { useRouter } from "next/navigation"
import { signOutTenant } from "../../actions/auth"
import type { AppDispatch } from "../../redux/store"
import {
  BookOpen,
  ChartNoAxesCombined,
  CircleUserRound,
  Code,
  Droplet,
  File,
  Gauge,
  Grid2x2,
  Landmark,
  LayoutGrid,
  LifeBuoyIcon,
  LockKeyhole,
  PieChart,
  SendIcon,
  Settings2,
  ShoppingCart,
  TriangleAlert,
  Tv,
  FrameIcon,
  PieChartIcon,
  MapIcon
} from "lucide-react"

// nav menues
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/products/01.png",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard/analytics",
      href: "/",
      icon: (
        <Gauge
        />
      ),
      isActive: true,
      // items: [
      //   {
      //     title: "Analytics",
      //     url: "/dashboard/analytics",
      //   },
      //   {
      //     title: "CRM",
      //     url: "/dashboard/crm",
      //   },
      //   {
      //     title: "eCommerce",
      //     url: "/dashboard/eCommerce",
      //   },
      // ],
    },
    {
      title: "eCommerce",
      url: "#",
      icon: (
        <ShoppingCart
        />
      ),
      items: [
        {
          title: "Product List",
          url: "/eCommerce/product-list",
        },
        {
          title: "Product Grid",
          url: "/eCommerce/product-grid",
        },
        {
          title: "Add Product",
          url: "/eCommerce/add-product",
        },
        {
          title: "Categories",
          url: "/eCommerce/categories",
        },
        {
          title: "Order List",
          url: "/eCommerce/order-list",
        },
        {
          title: "Order Details",
          url: "/eCommerce/order-details",
        },
        {
          title: "Customer List",
          url: "/eCommerce/customer-list",
        },
        {
          title: "Customer Details",
          url: "/eCommerce/customer-details",
        },
        {
          title: "Invoice",
          url: "/eCommerce/invoice",
        },
        
      ],
    },
    {
      title: "Widgets",
      url: "#",
      icon: (
        <Tv
        />
      ),
      items: [
        {
          title: "Data Widgets",
          url: "/widgets/data",
        },
        {
          title: "Statistics Widgets",
          url: "/widgets/statistics",
        },
      ],
    },
    {
      title: "Applications",
      url: "#",
      icon: (
        <LayoutGrid
        />
      ),
      items: [
        {
          title: "Chatbox",
          url: "/applications/chatbox",
        },
         {
          title: "Calendar",
          url: "/applications/calendar",
        },
         {
          title: "File Manager",
          url: "/applications/file-manager",
        },
         {
          title: "Invoice Card",
          url: "/applications/invoice",
        },
      ],
    },
    {
      title: "UI Components",
      url: "#",
      icon: (
        <Settings2
        />
      ),
      items: [
        {
          title: "Alerts",
          url: "/ui-components/alerts",
        },
        {
          title: "Accordion",
          url: "/ui-components/accordion",
        },
        {
          title: "Sooner",
          url: "/ui-components/sooner",
        },
        {
          title: "Badges",
          url: "/ui-components/badges",
        },
        {
          title: "Buttons",
          url: "/ui-components/buttons",
        },
        {
          title: "Cards",
          url: "/ui-components/cards",
        },
        {
          title: "List Groups",
          url: "/ui-components/list-groups",
        },
        {
          title: "Media Object",
          url: "/ui-components/media-object",
        },
        {
          title: "Navbars",
          url: "/ui-components/navbars",
        },
        {
          title: "Progress",
          url: "/ui-components/progressbars",
        },
        {
          title: "Spinners",
          url: "/ui-components/spinners",
        },
      ],
    },
    {
      title: "Forms",
      url: "#",
      icon: (
        <File
        />
      ),
      items: [
        {
          title: "Basic Inputs",
          url: "/forms/basic-inputs",
        },
        {
          title: "Input Groups",
          url: "/forms/input-groups",
        },
        {
          title: "Radio & Checkboxes",
          url: "/forms/checkboxes-radios",
        },
        {
          title: "Form Layouts",
          url: "/forms/form-layouts",
        },
        {
          title: "Form Wizard",
          url: "/forms/form-wizard",
        },
        {
          title: "Text Editor",
          url: "/forms/text-editor",
        },
        {
          title: "File Upload",
          url: "/forms/file-upload",
        },
        {
          title: "Date Pickers",
          url: "/forms/date-pickers",
        },
        {
          title: "Select",
          url: "/forms/select",
        },
        {
          title: "Form Repeat",
          url: "/forms/form-repeat",
        },
      ],
    },
    {
      title: "Tables",
      url: "#",
      icon: (<Grid2x2 />),
      items: [
        { title: "Basic Tables", url: "/tables/basic-tables" },
        { title: "Data Tables", url: "/tables/data-tables" },
        { title: "Advanced Tables", url: "/tables/advance-tables" },
      ],
    },
    {
      title: "Icons",
      url: "#",
      icon: (<Droplet />),
      items: [
        { title: "Boxicons", url: "/icons/boxicons" },
        { title: "Bootstrap", url: "/icons/bootstrap" },
        { title: "Lucide", url: "/icons/lucide" },
      ],
    },
    {
      title: "Pricing",
      url: "/pricing-tables",
      icon: (<Landmark />),
    },
    {
      title: "Authentication",
      url: "#",
      icon: (<LockKeyhole />),
      items: [
        {
          title: "Basic",
          url: "#",
          items: [
            { title: "Login", url: "/auth/basic/login" },
            { title: "Register", url: "/auth/basic/register" },
            { title: "Verify Email", url: "/auth/basic/verify-email" },
            { title: "Forgot Password", url: "/auth/basic/forgot-password" },
            { title: "New Password", url: "/auth/basic/reset-password" },
            { title: "Reset Success", url: "/auth/basic/password-reset-success" },
          ],
        },
        {
          title: "Cover",
          url: "#",
          items: [
            { title: "Login", url: "/auth/cover/login" },
            { title: "Register", url: "/auth/cover/register" },
            { title: "Verify Email", url: "/auth/cover/verify-email" },
            { title: "Forgot Password", url: "/auth/cover/forgot-password" },
            { title: "New Password", url: "/auth/cover/reset-password" },
            { title: "Reset Success", url: "/auth/cover/password-reset-success" },
          ],
        },
      ],
    },
    {
      title: "Accounts",
      url: "#",
      icon: (<CircleUserRound />),
      items: [
        { title: "Profile", url: "/account/profile" },
        { title: "Edit Profile", url: "/account/edit-profile" },
        { title: "Password Setting", url: "/account/password-setting" },
        { title: "Noitifications", url: "/account/notifications" },
      ],
    },
    {
      title: "Charts",
      url: "#",
      icon: (<ChartNoAxesCombined />),
      items: [
        { title: "ReCharts", url: "/charts/recharts" },
        { title: "Apex Charts", url: "/charts/apexcharts" },
      ],
    },
    {
      title: "Documentation",
      url: "/docs",
      icon: (<Code />),
    },
    {
      title: "FAQ",
      url: "/faq",
      icon: (<BookOpen />),
    },
    {
      title: "Error Pages",
      url: "#",
      icon: (<TriangleAlert />),
      items: [
        { title: "404 Not Found", url: "/error/error-404" },
        { title: "500 Server Error", url: "/error/error-500" },
        { title: "coming soon", url: "/error/coming-soon" },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: (
        <LifeBuoyIcon
        />
      ),
    },
    {
      title: "Feedback",
      url: "#",
      icon: (
        <SendIcon
        />
      ),
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: (
        <FrameIcon
        />
      ),
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: (
        <PieChartIcon
        />
      ),
    },
    {
      name: "Travel",
      url: "#",
      icon: (
        <MapIcon
        />
      ),
    },
  ],
}

// Normalize navigation URLs to match next.js app routes under `layout-pages` or `no-layout-pages`.
const layoutRoots = new Set([
  "dashboard",
  "eCommerce",
  "widgets",
  "applications",
  "ui-components",
  "forms",
  "tables",
  "icons",
  "pricing-tables",
  "account",
  "charts",
  "docs",
  "faq",
])

function resolveUrl(url: string) {
  if (!url || url === "#") return url
  const parts = url.split("/").filter(Boolean)
  if (parts.length === 0) return url
  const first = parts[0]

  if (layoutRoots.has(first)) {
    return `/layout-pages${url}`
  }

  // Auth pages live under `no-layout-pages/auth/*` except the app-level signin/signup
  if (first === "auth") {
    // map common login/register to top-level signin/signup
    if (parts[1] === "basic") {
      if (parts[2] === "login") return "/signin"
      if (parts[2] === "register") return "/signup"
      return `/no-layout-pages${url}`
    }
    return `/no-layout-pages${url}`
  }

  return url
}

function normalizeItems(items: any[] | undefined) {
  if (!items) return
  for (const it of items) {
    if (typeof it.url === "string") it.url = resolveUrl(it.url)
    if (Array.isArray(it.items)) normalizeItems(it.items)
  }
}

normalizeItems(data.navMain)
normalizeItems(data.navSecondary)

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const reduxUser = useSelector((state: RootState) => state.auth.user)
  const tenantProfile = useSelector((state: RootState) => state.tenant.profile)

  const userForNav = {
    name: reduxUser?.name || data.user.name,
    email: reduxUser?.email || data.user.email,
    avatar: "",
  }

  const handleLogout = async () => {
    await dispatch(signOutTenant())
    router.replace("/signin")
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="h-16 px-0 border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <PieChart className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Pulse UI</span>
                  <span className="truncate text-xs">{tenantProfile?.name || "Next.js Admin"}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2">
          <NavMain items={data.navMain} />
        </div>
        {/* <div className="border-b border-border">
          <NavProjects projects={data.projects} />
        </div>
        <div className="mt-auto">
          <NavSecondary items={data.navSecondary} />
        </div> */}
      </SidebarContent>
      <SidebarFooter className="">
        <NavUser user={userForNav} onLogout={handleLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
