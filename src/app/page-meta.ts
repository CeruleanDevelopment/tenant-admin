export type PageMeta = { title: string; description: string }

export const DEFAULT_DESCRIPTION =
  "Cerulean AI lets teams create, connect and chat with AI agents across their business tools."

// Page-wise metadata. Edit titles/descriptions here.
export const PAGE_META: Record<string, PageMeta> = {
  "/signin": { title: "Sign In", description: "Sign in to Cerulean AI with a one-time password." },
  "/signup": { title: "Sign Up", description: "Create your Cerulean AI account." },
  "/auth/callback": { title: "Signing In", description: "Completing your sign-in." },

  "/tenant/signin": { title: "Sign In", description: "Sign in to manage your tenant." },
  "/tenant/signup": { title: "Sign Up", description: "Register a new tenant workspace." },
  "/tenant/account": { title: "Account", description: "View and update your tenant account details." },
  "/tenant/agents": { title: "Agents", description: "Browse and manage your tenant's AI agents." },
  "/tenant/agents/create": { title: "Create Agent", description: "Set up a new AI agent with its connectors, roles and access." },
  "/tenant/agents/created": { title: "Agent Created", description: "Your agent has been created." },
  "/tenant/agents/conversations": { title: "Agent Conversations", description: "Review the conversations held with this agent." },
  "/tenant/audit": { title: "Audit Logs", description: "Review activity and changes across your tenant." },
  "/tenant/users": { title: "Users", description: "Manage the users in your tenant." },
  "/tenant/users/add": { title: "Add User", description: "Add a new user to your tenant." },
  "/tenant/users/edit": { title: "Edit User", description: "Update a user's details and access." },
  "/tenant/users/view": { title: "User Details", description: "View a user's details and access." },

  "/users/signin": { title: "Sign In", description: "Sign in with a one-time password, Microsoft or Google." },
  "/users/auth/callback": { title: "Signing In", description: "Completing your sign-in." },
  "/users/dashboard": { title: "Dashboard", description: "Your overview of agents and recent activity." },
  "/users/account": { title: "My Account", description: "View and update your profile and account settings." },
  "/users/agents": { title: "My Agents", description: "Agents assigned to you." },
  "/users/agents/chat": { title: "Agent Chat", description: "Chat with your AI agent." },
  "/users/agents/auth-complete": { title: "Connection Complete", description: "Finishing the connection to your account." },
}

const resolvePageMeta = (pathname: string): PageMeta | null => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (PAGE_META[path]) return PAGE_META[path]
  // Nearest parent match covers dynamic and nested routes.
  const segments = path.split("/")
  while (segments.length > 1) {
    segments.pop()
    const parent = PAGE_META[segments.join("/")]
    if (parent) return parent
  }
  return null
}

export const buildPageMeta = (pathname: string): { title: string; description: string } => {
  const meta = resolvePageMeta(pathname)
  const suffix = pathname.startsWith("/tenant") ? "Tenant Admin" : pathname.startsWith("/users") ? "User Portal" : "Cerulean AI"
  return {
    title: meta ? `${meta.title} | ${suffix}` : suffix,
    description: meta?.description ?? DEFAULT_DESCRIPTION,
  }
}
