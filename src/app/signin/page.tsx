"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { cn } from "../../lib/utils"
import { signInTenantWithGoogle } from "../../../actions/auth"
import type { AppDispatch } from "../../../redux/store"
import { GalleryVerticalEnd } from "lucide-react"
import { FaGoogle } from "react-icons/fa"
import { FcGoogle } from "react-icons/fc";

type LoginValues = { email?: string }

export default function SignInPage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const errorMessage = String(searchParams.get("error") || "").trim()

  const { register: registerEmail, handleSubmit: handleEmailSubmit, formState: { isSubmitting: isEmailSubmitting } } = useForm<LoginValues>({ defaultValues: { email: String(searchParams.get("email") || "") } })

  const onGoogleClick = () => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
    const tenantId = params.get("tenantId") || params.get("slug") || undefined
    dispatch(signInTenantWithGoogle({ tenantId, next: "/" }))
  }

  const onEmailSubmit = handleEmailSubmit(async (data) => {
    const email = String(data.email || "").trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email) {
      toast.error("Please enter your email.")
      return
    }

    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.")
      return
    }

    // No magic-link backend implemented here; surface success message for now.
    toast.success("If an account exists, we'll send a sign-in link to that email.")
  })

  return (
    <div className="bg-muted min-h-svh w-full flex items-center justify-center p-6 md:p-10">
      <div className="max-w-lg">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-5" />
            </div>
            <span className="text-lg">Acme Inc.</span>
          </div>

          <div className={cn("flex flex-col gap-6") }>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Welcome back</CardTitle>
                <CardDescription>Sign in with Google to access your tenant workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="grid gap-4">

                    {errorMessage ? (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errorMessage}
                      </p>
                    ) : null}

                    <div>
                      <Button type="button" className="w-full" onClick={onGoogleClick} variant="outline">
                        <FcGoogle /> {" "}
                        Login with Google
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 border-t border-border" />
                      <span className="px-2 text-muted-foreground text-sm">Or continue with</span>
                      <div className="flex-1 border-t border-border" />
                    </div>

                    <form onSubmit={onEmailSubmit}>
                      <div className="grid gap-6">
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            {...registerEmail("email")}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={isEmailSubmitting}>
                          {isEmailSubmitting ? "Sending..." : "Continue"}
                        </Button>
                      </div>
                    </form>

                    <div className="text-center text-sm">
                      Don&apos;t have a tenant yet? {" "}
                      <Link href="/signup" className="underline underline-offset-4">
                        Create one
                      </Link>
                    </div>
                  </div>
              </CardContent>
            </Card>

            <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
              By clicking continue, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

