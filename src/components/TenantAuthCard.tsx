"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
  signInTenantWithGoogle,
  signUpTenantWithGoogle,
  verifyTenantOtp,
} from "../../actions/auth"
import type { AppDispatch } from "../../redux/store"

type AuthMode = "signin" | "signup"

type TenantAuthCardProps = {
  mode: AuthMode
}

type AuthValues = {
  email?: string
}

const OTP_LENGTH = 6

const resolveCopy = (mode: AuthMode) => {
  if (mode === "signup") {
    return {
      eyebrow: "Create your tenant",
      title: "Launch a workspace in minutes",
      description: "Use Google or a one-time code to create the tenant, then jump straight into the dashboard.",
      primaryButton: "Continue with Google",
      footerPrefix: "Already have a tenant?",
      footerHref: "/signin",
      footerLabel: "Sign in",
      successMessage: "Tenant created and signed in successfully.",
    }
  }

  return {
    eyebrow: "Welcome back",
    title: "Sign in without friction",
    description: "Use Google or a six-digit code to get back into your tenant dashboard fast.",
    primaryButton: "Continue with Google",
    footerPrefix: "Don’t have a tenant yet?",
    footerHref: "/signup",
    footerLabel: "Create one",
    successMessage: "Signed in successfully.",
  }
}

export function TenantAuthCard({ mode }: TenantAuthCardProps) {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const copy = useMemo(() => resolveCopy(mode), [mode])
  const errorMessage = String(searchParams.get("error") || "").trim()
  const initialEmail = String(searchParams.get("email") || "")
  const initialTenantId = searchParams.get("tenantId") || searchParams.get("slug") || undefined
  const tenantName = searchParams.get("tenantName") || undefined
  const slug = searchParams.get("slug") || undefined

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

  const authGoogle = mode === "signup" ? signUpTenantWithGoogle : signInTenantWithGoogle

  const requestOtp = async (email: string) => {
    setIsRequestingOtp(true)
    const response = await dispatch(
      requestTenantOtp({
        email,
        mode,
        tenantId: initialTenantId,
        tenantName,
        slug,
      }),
    )

    setSessionId(response.sessionId)
    setExpiresAt(response.expiresAt)
    setResendSeconds(response.resendCooldownSeconds)
    setOtpValue("")
    setStage("otp")
    toast.success("OTP sent. Check your inbox.")
  }

  const completeOtp = async (code: string) => {
    if (!sessionId || isRequestingOtp || code.length < OTP_LENGTH || isVerifying) {
      return
    }

    setIsVerifying(true)
    try {
      const response = await dispatch(
        verifyTenantOtp({
          sessionId,
          code,
          mode,
          tenantId: initialTenantId,
          tenantName,
          slug,
        }),
      )

      const hydrated = await dispatch(hydrateTenantSession({ token: response.token, refreshToken: response.refreshToken }))
      if (hydrated) {
        toast.success(copy.successMessage)
        window.location.assign("/")
        return
      }

      toast.error("Unable to complete authentication.")
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Invalid code."
      toast.error(String(message))
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    if (otpValue.length === OTP_LENGTH) {
      void completeOtp(otpValue)
    }
  }, [otpValue])

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
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Failed to send OTP."
      toast.error(String(message))
      setStage("email")
    } finally {
      setIsRequestingOtp(false)
    }
  })

  const onGoogleClick = () => {
    dispatch(
      authGoogle({
        tenantId: initialTenantId,
        slug,
        tenantName,
        next: "/",
      }),
    )
  }

  const resendOtp = async () => {
    if (!emailValue || resendSeconds > 0 || isRequestingOtp) {
      return
    }

    try {
      await requestOtp(emailValue)
      toast.success("OTP resent. Check your inbox.")
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || "Failed to resend OTP."
      toast.error(String(message))
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#0f172a_0%,#111827_50%,#020617_100%)] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-size-[24px_24px] opacity-20" />
      <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -right-20 bottom-12 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-400/15 ring-1 ring-cyan-300/30">
                <WandSparkles className="size-5 text-cyan-200" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-300">Tenant Admin</p>
                <p className="text-sm text-slate-400">Secure access for tenant operators</p>
              </div>
            </div>

            <div className="mt-10 max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                <Sparkles className="size-3.5" />
                OTP + Google authentication
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
                {copy.description}
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, label: "Hashed OTP storage" },
                { icon: MailCheck, label: "6-digit auto-submit" },
                { icon: BadgeCheck, label: "30s resend cooldown" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                  <item.icon className="size-5 text-cyan-200" />
                  <p className="mt-3 text-sm text-slate-200">{item.label}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs text-slate-400">
              The dashboard opens automatically after OTP verification or Google sign-in succeeds.
            </p>
          </div>

          <Card className="overflow-hidden border-white/10 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="border-b border-white/10 bg-white/5 px-6 py-5 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">{copy.eyebrow}</p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">{copy.eyebrow}</h2>
                  </div>
                  <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100 sm:inline-flex">
                    Dashboard ready
                  </div>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6 sm:px-8">
                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {errorMessage}
                  </div>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={onGoogleClick}
                >
                  <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-white/10 text-sm">G</span>
                  {copy.primaryButton}
                </Button>

                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.26em] text-slate-400">
                  <span className="h-px flex-1 bg-white/10" />
                  Or continue with email
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                {stage === "email" ? (
                  <form onSubmit={onEmailSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm text-slate-200">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-cyan-400/40"
                        {...register("email")}
                        value={emailValue}
                        onChange={(event) => setEmailValue(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <Button type="submit" className="h-12 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={isSubmitting}>
                      {isSubmitting ? "Sending..." : mode === "signup" ? "Get verification code" : "Continue"}
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                      <p className="text-sm text-cyan-100">We sent a code to</p>
                      <p className="mt-1 break-all font-medium text-white">{emailValue}</p>
                      {expiresAt ? <p className="mt-1 text-xs text-slate-400">Expires at {new Date(expiresAt).toLocaleTimeString()}</p> : null}
                      {expiresInSeconds > 0 ? (
                        <p className="mt-1 text-xs text-slate-400">
                          Code expires in {Math.floor(expiresInSeconds / 60)}m {expiresInSeconds % 60}s
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-sm text-slate-200">Enter 6-digit OTP</Label>
                      <TenantOtpInput value={otpValue} onChange={setOtpValue} length={OTP_LENGTH} />
                      {isRequestingOtp ? (
                        <p className="text-xs text-slate-400">Sending OTP to your email...</p>
                      ) : null}
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className="h-12 flex-1 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                        onClick={() => void completeOtp(otpValue)}
                        disabled={isRequestingOtp || isVerifying || otpValue.length !== OTP_LENGTH}
                      >
                        {isVerifying ? "Verifying..." : "Verify and continue"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
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
                      className="w-full text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
                    >
                      Use a different email
                    </button>
                  </div>
                )}

                <div className="pt-2 text-center text-sm text-slate-400">
                  {copy.footerPrefix} <Link href={copy.footerHref} className="text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline">{copy.footerLabel}</Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
