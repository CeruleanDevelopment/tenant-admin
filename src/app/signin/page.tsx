"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { cn } from "../../lib/utils"
import { TenantOtpInput } from "../../components/TenantOtpInput"
import {
  hydrateTenantSession,
  requestTenantOtp,
  verifyTenantOtp,
} from "../../../actions/auth"
import type { AppDispatch } from "../../../redux/store"
import { GalleryVerticalEnd, RefreshCcw, ShieldCheck } from "lucide-react"

type LoginValues = { email?: string }

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

export default function SignInPage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const errorMessage = String(searchParams.get("error") || "").trim()

  const [stage, setStage] = useState<"email" | "otp">("email")
  const [emailValue, setEmailValue] = useState(String(searchParams.get("email") || ""))
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [otpValue, setOtpValue] = useState("")
  const [resendSeconds, setResendSeconds] = useState(0)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register: registerEmail, handleSubmit: handleEmailSubmit, formState: { isSubmitting: isEmailSubmitting } } = useForm<LoginValues>({
    defaultValues: { email: String(searchParams.get("email") || "") },
  })

  useEffect(() => {
    if (resendSeconds <= 0) {
      return
    }

    const timerId = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1))
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [resendSeconds])

  const onEmailSubmit = handleEmailSubmit(async (data) => {
    const email = String(data.email || emailValue || "").trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!email) {
      toast.error("Please enter your email.")
      return
    }

    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.")
      return
    }

    setFormError(null)
    setEmailValue(email)
    setIsRequestingOtp(true)

    try {
      const response = await dispatch(
        requestTenantOtp({
          email,
          tenantId: searchParams.get("tenantId") || searchParams.get("slug") || undefined,
          tenantName: searchParams.get("tenantName") || undefined,
          slug: searchParams.get("slug") || undefined,
        }),
      )

      setSessionId(response.sessionId)
      setResendSeconds(Math.max(RESEND_COOLDOWN_SECONDS, Number(response.resendCooldownSeconds) || 0))
      setOtpValue("")
      setStage("otp")
      setFormError(null)
      toast.success("OTP sent to your email.")
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || "Failed to send OTP."
      setFormError(String(message))
      toast.error(String(message))
    } finally {
      setIsRequestingOtp(false)
    }
  })

  const onVerifyOtp = async () => {
    if (!sessionId || otpValue.length !== OTP_LENGTH || isVerifyingOtp) {
      return
    }

    setIsVerifyingOtp(true)
    try {
      const response = await dispatch(
        verifyTenantOtp({
          sessionId,
          code: otpValue,
          tenantId: searchParams.get("tenantId") || searchParams.get("slug") || undefined,
          tenantName: searchParams.get("tenantName") || undefined,
          slug: searchParams.get("slug") || undefined,
        }),
      )

      const hydrated = await dispatch(
        hydrateTenantSession({ token: response.token, refreshToken: response.refreshToken }),
      )

      if (hydrated) {
        toast.success("Signed in successfully.")
        window.location.assign("/")
        return
      }

      toast.error("Unable to complete authentication.")
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || "Invalid OTP code."
      setFormError(String(message))
      toast.error(String(message))
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const onResendOtp = async () => {
    if (!emailValue || resendSeconds > 0 || isRequestingOtp) {
      return
    }

    setIsRequestingOtp(true)
    try {
      const response = await dispatch(
        requestTenantOtp({
          email: emailValue,
          tenantId: searchParams.get("tenantId") || searchParams.get("slug") || undefined,
          tenantName: searchParams.get("tenantName") || undefined,
          slug: searchParams.get("slug") || undefined,
        }),
      )

      setSessionId(response.sessionId)
      setResendSeconds(Math.max(RESEND_COOLDOWN_SECONDS, Number(response.resendCooldownSeconds) || 0))
      setOtpValue("")
      toast.success("OTP resent.")
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || "Failed to resend OTP."
      setFormError(String(message))
      toast.error(String(message))
    } finally {
      setIsRequestingOtp(false)
    }
  }

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

          <div className={cn("flex flex-col gap-6")}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Sign in to your tenant</CardTitle>
                <CardDescription>
                  {stage === "email"
                    ? "Use your registered email and continue with OTP."
                    : "Enter the 6-digit OTP sent to your email."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {(formError || errorMessage) ? (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError || errorMessage}
                    </p>
                  ) : null}

                  {/* {stage === "email" ? (
                    <>
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4" />
                          Enter your registered tenant admin email to receive OTP.
                        </div>
                      </div>
                    </>
                  ) : null} */}

                  {stage === "email" ? (
                    <form onSubmit={onEmailSubmit}>
                      <div className="grid gap-6">
                        <div className="grid gap-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="m@example.com"
                            {...registerEmail("email")}
                            value={emailValue}
                            onChange={(event) => setEmailValue(event.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full cursor-pointer" disabled={isEmailSubmitting || isRequestingOtp}>
                          {isRequestingOtp ? "Sending OTP..." : "Continue"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid gap-4">
                      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
                        OTP sent to <span className="font-medium">{emailValue}</span>
                      </div>

                      <TenantOtpInput
                        value={otpValue}
                        onChange={setOtpValue}
                        length={OTP_LENGTH}
                        disabled={isRequestingOtp || isVerifyingOtp}
                      />

                      <Button
                        type="button"
                        className="w-full cursor-pointer"
                        onClick={onVerifyOtp}
                        disabled={!sessionId || otpValue.length !== OTP_LENGTH || isRequestingOtp || isVerifyingOtp}
                      >
                        {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                      </Button>

                      <div className="flex items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className=" cursor-pointer"
                          onClick={onResendOtp}
                          disabled={isRequestingOtp || resendSeconds > 0}
                        >
                          <RefreshCcw className="mr-2 size-4" />
                          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className=" cursor-pointer"
                          onClick={() => {
                            setStage("email")
                            setOtpValue("")
                            setSessionId(null)
                          }}
                        >
                          Change email
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="text-center text-sm">
                    Don&apos;t have a tenant yet? {" "}
                    <Link href="/signup" className="underline underline-offset-4">
                      Signup
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

