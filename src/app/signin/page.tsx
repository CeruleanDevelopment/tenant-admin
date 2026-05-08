"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { cn } from "../../lib/utils"
import { signInTenantWithGoogle } from "../../../actions/auth"
import type { AppDispatch } from "../../../redux/store"
import { GalleryVerticalEnd } from "lucide-react"
import { FaGoogle } from "react-icons/fa"
import { FcGoogle } from "react-icons/fc";

type LoginValues = Record<string, never>

export default function SignInPage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const { handleSubmit, formState: { isSubmitting } } = useForm<LoginValues>({ defaultValues: {} })
  const errorMessage = String(searchParams.get("error") || "").trim()

  const onSubmit = handleSubmit(() => {
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams()
    const tenantId = params.get("tenantId") || params.get("slug") || undefined
    dispatch(signInTenantWithGoogle({ tenantId, next: "/" }))
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
                <form onSubmit={onSubmit}>
                  <div className="grid gap-4">
                    {errorMessage ? (
                      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errorMessage}
                      </p>
                    ) : null}

                    {/* <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Redirecting..." : "Continue with Google"}
                    </Button> */}
                    <Button  type="submit" className="w-full" disabled={isSubmitting} variant="outline">
                      <FcGoogle /> {" "}
                      {isSubmitting ? "Redirecting..." : "Login with Google"}
                    </Button>

                    <div className="text-center text-sm">
                      Don&apos;t have a tenant yet? {" "}
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
        </div>
      </div>
    </div>
  )
}

