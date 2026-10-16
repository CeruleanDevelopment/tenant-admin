"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ArrowRight, BadgeCheck, MailCheck, RefreshCcw, ShieldCheck, Sparkles, WandSparkles } from "lucide-react"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card, CardContent } from "./ui/card"
import { TenantOtpInput } from "./TenantOtpInput"
import {
  hydrateTenantSession,
  requestTenantOtp,
  verifyTenantOtp,
} from "../../actions/auth"
import type { AppDispatch } from "../../redux/store"

type AuthValues = {
  email?: string
}

const OTP_LENGTH = 6

const copy = {
  title: "Sign in without friction",
  description: "Use a six-digit code to get back into your tenant dashboard fast.",
  eyebrow: "Welcome back",
  successMessage: "Signed in successfully.",
}

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>
    const resp = e["response"]
    if (typeof resp === "object" && resp !== null) {
      const data = (resp as Record<string, unknown>)["data"]
      if (typeof data === "object" && data !== null) {
        const error = (data as Record<string, unknown>)["error"]
        if (typeof error === "string") return error
      }
    }

    const msg = e["message"]
    if (typeof msg === "string") return msg

    try {
      return JSON.stringify(e)
    } catch {
      return "An error occurred"
    }
  }

  return String(err)
}

export function TenantAuthCard() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const getParam = (key: string): string => searchParams?.get(key) || ""
  const errorMessage = String(getParam("error")).trim()
  const initialEmail = String(getParam("email"))
  const initialTenantId = getParam("tenantId") || getParam("slug") || undefined
  const slug = getParam("slug") || undefined

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<AuthValues>({
    defaultValues: { email: initialEmail },
  })

  const [stage, setStage] = useState<"email" | "otp">("email")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [emailValue, setEmailValue] = useState(initialEmail)
  const [otpValue, setOtpValue] = useState("")
  const [resendSeconds, setResendSeconds] = useState(0)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [expiresInSeconds, setExpiresInSeconds] = useState(0)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const lastSubmittedOtpKeyRef = useRef<string>("")

  useEffect(() => {
    if (resendSeconds <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1))
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [resendSeconds])

  useEffect(() => {
    if (!expiresAt) {
      setExpiresInSeconds(0)
      return
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setExpiresInSeconds(remaining)
    }

    updateRemaining()
    const intervalId = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(intervalId)
  }, [expiresAt])

  // Google auth disabled for now; OTP flows remain active.

  const requestOtp = async (email: string) => {
    setIsRequestingOtp(true)
    const response = await dispatch(
      requestTenantOtp({
        email,
        tenantId: initialTenantId,
        slug,
      }),
    )

    setSessionId(response.sessionId)
    setExpiresAt(response.expiresAt)
    setResendSeconds(response.resendCooldownSeconds)
    setOtpValue("")
    lastSubmittedOtpKeyRef.current = ""
    setStage("otp")
    toast.success("OTP sent. Check your inbox.")
  }

  const completeOtp = useCallback(async (code: string) => {
    if (!sessionId || isRequestingOtp || code.length < OTP_LENGTH || isVerifying) {
      return
    }

    setIsVerifying(true)
    try {
      const response = await dispatch(
        verifyTenantOtp({
          sessionId,
          code,
          tenantId: initialTenantId,
          slug,
        }),
      )

      const hydrated = await dispatch(hydrateTenantSession({ token: response.token, refreshToken: response.refreshToken }))
      if (hydrated) {
        toast.success(copy.successMessage)
        setOtpValue("")
        window.location.assign("/")
        return
      }

      toast.error("Unable to complete authentication.")
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Invalid code."
      toast.error(message)
    } finally {
      setIsVerifying(false)
    }
  }, [sessionId, isRequestingOtp, isVerifying, dispatch, initialTenantId, slug])

  useEffect(() => {
    if (otpValue.length < OTP_LENGTH) {
      lastSubmittedOtpKeyRef.current = ""
      return
    }
    if (otpValue.length === OTP_LENGTH) {
      const otpKey = `${String(sessionId || "").trim()}:${otpValue}`
      if (otpKey && lastSubmittedOtpKeyRef.current === otpKey) {
        return
      }
      lastSubmittedOtpKeyRef.current = otpKey
      void completeOtp(otpValue)
    }
  }, [otpValue, sessionId, completeOtp])

  const onEmailSubmit = handleSubmit(async (data) => {
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

    setEmailValue(email)
    setStage("otp")
    setSessionId(null)
    setOtpValue("")
    setExpiresAt(null)
    setResendSeconds(0)

    try {
      await requestOtp(email)
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Failed to send OTP."
      toast.error(message)
      setStage("email")
    } finally {
      setIsRequestingOtp(false)
    }
  })

  // Google auth disabled; no-op placeholder left intentionally.

  const resendOtp = async () => {
    if (!emailValue || resendSeconds > 0 || isRequestingOtp) {
      return
    }

    try {
      await requestOtp(emailValue)
      toast.success("OTP resent. Check your inbox.")
    } catch (err: unknown) {
      const message = getErrorMessage(err) || "Failed to resend OTP."
      toast.error(message)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-size-[24px_24px]" />
      <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-12 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between rounded-3xl border border-border bg-muted/40 p-6 shadow-xl shadow-black/5 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                <WandSparkles className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-foreground">Tenant Admin</p>
                <p className="text-sm text-muted-foreground">Secure access for tenant operators</p>
              </div>
            </div>

            <div className="mt-10 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                OTP authentication
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
                {copy.description}
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: "Hashed OTP storage" },
                { icon: MailCheck, label: "6-digit auto-submit" },
                { icon: BadgeCheck, label: "30s resend cooldown" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-background p-4">
                  <item.icon className="size-5 text-primary" />
                  <p className="mt-3 text-sm text-foreground">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs text-muted-foreground">
              The dashboard opens automatically after OTP verification or Google sign-in succeeds.
            </p>
          </div>

          <Card className="overflow-hidden border-border bg-card text-card-foreground shadow-xl shadow-black/5">
            <CardContent className="p-0">
              <div className="border-b border-border bg-muted/40 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-primary">{copy.eyebrow}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-foreground">{copy.eyebrow}</h2>
                  </div>
                  <div className="hidden rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary sm:inline-flex">
                    Dashboard ready
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6 sm:px-8">
                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}

                {/* <div className="mb-2 rounded-md bg-white/5 px-4 py-3 text-sm text-slate-300">Google sign-in is temporarily disabled. Use email and a one-time code (OTP) below to continue.</div>

                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.26em] text-slate-400">
                  <span className="h-px flex-1 bg-white/10" />
                  Or continue with email
                  <span className="h-px flex-1 bg-white/10" />
                </div> */}

                {stage === "email" ? (
                  <form onSubmit={onEmailSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm text-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="h-12 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
                        {...register("email")}
                        value={emailValue}
                        onChange={(event) => setEmailValue(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <Button type="submit" className="h-12 w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : "Continue"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm text-primary">We sent a code to</p>
                      <p className="mt-1 break-all font-medium text-foreground">{emailValue}</p>
                      {expiresAt ? <p className="mt-1 text-xs text-muted-foreground">Expires at {new Date(expiresAt).toLocaleTimeString()}</p> : null}
                      {expiresInSeconds > 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Code expires in {Math.floor(expiresInSeconds / 60)}m {expiresInSeconds % 60}s
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-sm text-foreground">Enter 6-digit OTP</Label>
                      <TenantOtpInput
                        value={otpValue}
                        onChange={setOtpValue}
                        length={OTP_LENGTH}
                        disabled={isRequestingOtp || isVerifying}
                        inputClassName="border-input bg-background text-foreground caret-primary focus:border-primary focus:ring-primary/30"
                      />
                      {isRequestingOtp ? (
                        <p className="text-xs text-muted-foreground">Sending OTP to your email...</p>
                      ) : null}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className="h-12 flex-1"
                        onClick={() => void completeOtp(otpValue)}
                        disabled={isRequestingOtp || isVerifying || otpValue.length !== OTP_LENGTH}
                      >
                        {isVerifying ? "Verifying..." : "Verify and continue"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={() => void resendOtp()}
                        disabled={isRequestingOtp || resendSeconds > 0}
                      >
                        <RefreshCcw className="mr-2 size-4" />
                        {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend"}
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setStage("email")
                        setOtpValue("")
                        setSessionId(null)
                      }}
                      className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Use a different email
                    </button>
                  </div>
                )}

                <div className="pt-2 text-center text-sm text-muted-foreground">
                  Don’t have a tenant yet?{" "}
                  <Link href="/tenant/signup" prefetch={false} className="text-primary underline-offset-4 hover:underline">Register</Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
