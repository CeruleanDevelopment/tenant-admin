"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"

import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { cn } from "../lib/utils"
import { signInTenantWithGoogle } from "../../actions/auth"
import type { AppDispatch } from "../../redux/store"

type LoginValues = Record<string, never>

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const searchParams = useSearchParams()
  const dispatch = useDispatch<AppDispatch>()
  const { handleSubmit, formState: { isSubmitting } } = useForm<LoginValues>({ defaultValues: {} })

  const tenantId = searchParams.get("tenantId") || searchParams.get("slug") || undefined

  const onSubmit = handleSubmit(() => {
    dispatch(signInTenantWithGoogle({ tenantId, next: "/" }))
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in with Google to access your tenant workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <div className="grid gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Redirecting..." : "Continue with Google"}
              </Button>

              <div className="text-center text-sm">
                Don&apos;t have a tenant yet?{" "}
                <Link href="/signup" className="underline underline-offset-4">
                  Create one
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
