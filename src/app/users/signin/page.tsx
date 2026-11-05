"use client"

export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useDispatch } from "react-redux"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { ChangeEvent } from "react"

import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { cn } from "../../../lib/utils"
import { TenantOtpInput } from "../../../components/TenantOtpInput"
import {
  requestUserOtp,
  startUserProviderSignIn,
  verifyUserOtp,
  USER_AUTH_MESSAGE_SOURCE,
  USER_AUTH_POPUP_NAME,
} from "../../../../actions/userAuth"
import type { AppDispatch } from "../../../../redux/store"
import { GalleryVerticalEnd, RefreshCcw } from "lucide-react"
import { FcGoogle } from "react-icons/fc";

type LoginValues = { email?: string }

const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 300

const normalizeUserNextPath = (value: string): string => {
  const candidate = String(value || "").trim()
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/users/dashboard"
  }

  if (candidate === "/users/signin" || candidate.startsWith("/users/signin?")) {
    return "/users/dashboard"
  }

  if (!candidate.startsWith("/users")) {
    return "/users/dashboard"
  }

  return candidate
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const knownError = error as {
      response?: { data?: { error?: unknown } }
      message?: unknown
    }

    const apiError = knownError.response?.data?.error
    if (typeof apiError === "string" && apiError.trim()) {
      return apiError
    }

    if (typeof knownError.message === "string" && knownError.message.trim()) {
      return knownError.message
    }
  }

  return fallback
}

export default function SignInPage() {
  const dispatch = useDispatch<AppDispatch>()
  const searchParams = useSearchParams()
  const getParam = (key: string): string => searchParams?.get(key) || ""
  const errorMessage = String(getParam("error")).trim()
  const nextPath = String(getParam("next")).trim()

  const [stage, setStage] = useState<"email" | "otp">("email")
  const [emailValue, setEmailValue] = useState(String(getParam("email")))
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [otpValue, setOtpValue] = useState("")
  const [resendSeconds, setResendSeconds] = useState(0)
  const [isRequestingOtp, setIsRequestingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { register: registerEmail, handleSubmit: handleEmailSubmit, formState: { isSubmitting: isEmailSubmitting } } = useForm<LoginValues>({
    defaultValues: { email: String(getParam("email")) },
  })

  useEffect(() => {
    // Provider errors redirect here inside the popup; hand them to the opener.
    if (errorMessage && window.name === USER_AUTH_POPUP_NAME && window.opener) {
      window.opener.postMessage({ source: USER_AUTH_MESSAGE_SOURCE, error: errorMessage }, window.location.origin)
      window.close()
    }
  }, [errorMessage])

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
        requestUserOtp({ email }),
      )

      setSessionId(response.sessionId)
      setResendSeconds(Math.max(RESEND_COOLDOWN_SECONDS, Number(response.resendCooldownSeconds) || 0))
      setOtpValue("")
      setStage("otp")
      setFormError(null)
      toast.success("OTP sent to your email.")
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to send OTP.")
      setFormError(message)
      toast.error(message)
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
        verifyUserOtp({
          sessionId,
          code: otpValue,
        }),
      )

      if (response?.token && response?.refreshToken) {
        toast.success("Signed in successfully.")
        const safeNext = normalizeUserNextPath(nextPath)
        window.location.assign(safeNext)
        return
      }

      toast.error("Unable to complete authentication.")
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Invalid OTP code.")
      setFormError(message)
      toast.error(message)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const onMicrosoftSignIn = () => {
    startProviderSignIn("microsoft")
  }

  const onGoogleSignIn = () => {
    startProviderSignIn("google")
  }

  const startProviderSignIn = async (provider: "microsoft" | "google") => {
    setFormError(null)
    try {
      await dispatch(startUserProviderSignIn(provider, normalizeUserNextPath(nextPath)))
      toast.success("Signed in successfully.")
      window.location.assign(normalizeUserNextPath(nextPath))
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to complete sign-in.")
      setFormError(message)
      toast.error(message)
    }
  }

  const onResendOtp = async () => {
    if (!emailValue || resendSeconds > 0 || isRequestingOtp) {
      return
    }

    setIsRequestingOtp(true)
    try {
      const response = await dispatch(
        requestUserOtp({ email: emailValue }),
      )

      setSessionId(response.sessionId)
      setResendSeconds(Math.max(RESEND_COOLDOWN_SECONDS, Number(response.resendCooldownSeconds) || 0))
      setOtpValue("")
      toast.success("OTP resent.")
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to resend OTP.")
      setFormError(message)
      toast.error(message)
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
            <span className="text-lg">Cerulean</span>
          </div>

          <div className={cn("flex flex-col gap-6")}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Sign in to your account</CardTitle>
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
                    <div className="grid gap-6">
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
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmailValue(event.target.value)}
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full cursor-pointer" disabled={isEmailSubmitting || isRequestingOtp}>
                          {isRequestingOtp ? "Sending OTP..." : "Continue"}
                        </Button>
                      </div>
                    </form>
                      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                        <span className="relative z-10 bg-card px-2 text-muted-foreground">Or</span>
                      </div>
                      <Button type="button" variant="outline" className="w-full cursor-pointer" onClick={onMicrosoftSignIn}>
                        <svg className="mr-2 size-4" viewBox="0 0 23 23" aria-hidden="true">
                          <path fill="#f35325" d="M1 1h10v10H1z" />
                          <path fill="#81bc06" d="M12 1h10v10H12z" />
                          <path fill="#05a6f0" d="M1 12h10v10H1z" />
                          <path fill="#ffba08" d="M12 12h10v10H12z" />
                        </svg>
                        Sign in with Microsoft
                      </Button>
                      {/* <Button type="button" variant="outline" className="w-full cursor-pointer" onClick={onGoogleSignIn}>
                        <FcGoogle className="mr-2 size-4" />
                        Sign in with Google
                      </Button> */}
                    </div>
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

                  {/* <div className="text-center text-sm">
                    Don&apos;t have a tenant yet? {" "}
                    <Link href={TENANT_SIGNUP_PATH} prefetch={false} className="underline underline-offset-4">
                      Signup
                    </Link>
                  </div> */}
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

