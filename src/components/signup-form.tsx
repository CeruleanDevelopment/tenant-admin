"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"

import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { cn } from "../lib/utils"
import { useRouter } from "next/navigation"
import type { AppDispatch } from "../../redux/store"

type SignupValues = Record<string, never>

export function SignupForm({ className, ...props }: React.ComponentProps<"div">) {
  const searchParams = useSearchParams()
  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const { handleSubmit, formState: { isSubmitting } } = useForm<SignupValues>({ defaultValues: {} })

  const tenantId = searchParams.get("tenantId") || searchParams.get("slug") || undefined

  const onSubmit = handleSubmit(() => {
    // Google sign-up is disabled for now; open the full registration form instead.
    router.push('/signup')
  })

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
          <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your tenant</CardTitle>
          <CardDescription>Open the registration form to create and access a tenant workspace.</CardDescription>
        </CardHeader>
        <CardContent>
              <form onSubmit={onSubmit}>
            <div className="grid gap-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Opening..." : "Open registration form"}
              </Button>

              <div className="text-center text-sm">
                Already have a tenant?{" "}
                <Link href="/signin" className="underline underline-offset-4">
                  Sign in
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
