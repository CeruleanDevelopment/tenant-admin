"use client"

export const dynamic = "force-dynamic"

const TENANT_SIGNIN_PATH = "/tenannt/signin"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useDispatch } from "react-redux"
import { Controller, useForm } from "react-hook-form"
import { DropdownList } from "react-widgets"
import { toast } from "sonner"

import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card"
import { cn } from "../../../lib/utils"
import { fetchCountries, registerTenant, type ActiveCountry } from "../../../../actions/auth"
import type { AppDispatch } from "../../../../redux/store"
import { Building2, GalleryVerticalEnd } from "lucide-react"

type SignupValues = {
  firstName: string
  lastName: string
  email: string
  companyName: string
  countryId: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postalCode?: string
}

// Client-side validation patterns and limits (keep in sync with backend)
const NAME_PATTERN = /^[A-Za-z\s'\-]+$/;
const CITY_STATE_PATTERN = /^[A-Za-z0-9\s'\-\.,]+$/;
const PHONE_PATTERN = /^[0-9]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = {
  firstName: 255,
  lastName: 255,
  email: 255,
  companyName: 255,
  phone: 20,
  address1: 255,
  address2: 255,
  city: 255,
  state: 255,
  postalCode: 25,
};

export default function SignUpPage() {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingCountries, setIsLoadingCountries] = useState(true)
  const [countries, setCountries] = useState<ActiveCountry[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const showFieldErrors = !formError

  const sortedCountries = useMemo(() => {
    return [...countries].sort((a, b) => a.name.localeCompare(b.name))
  }, [countries])

  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<SignupValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyName: "",
      countryId: "",
      phone: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
    },
  })

  useEffect(() => {
    let mounted = true

    const loadCountries = async () => {
      try {
        const rows = await dispatch(fetchCountries())
        if (mounted) {
          setCountries(rows)
        }
      } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || "Unable to load countries"
        toast.error(String(message))
      } finally {
        if (mounted) {
          setIsLoadingCountries(false)
        }
      }
    }

    void loadCountries()

    return () => {
      mounted = false
    }
  }, [dispatch])

  const onRegister = handleSubmit(async (data) => {
    clearErrors()
    setFormError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)
    try {
      var formData = {
        firstName: String(data.firstName || "").trim(),
        lastName: String(data.lastName || "").trim(),
        email: String(data.email || "").trim().toLowerCase(),
        companyName: String(data.companyName || "").trim(),
        countryId: String(data.countryId || "").trim(),
        phone: String(data.phone || "").trim() || undefined,
        address1: String(data.address1 || "").trim() || undefined,
        address2: String(data.address2 || "").trim() || undefined,
        city: String(data.city || "").trim() || undefined,
        state: String(data.state || "").trim() || undefined,
        postalCode: String(data.postalCode || "").trim() || undefined,
      }
      console.log(formData,"data");
      
      const response = await dispatch(registerTenant(formData))
      // toast.success(response.message || "Registered successfully. Please sign in with OTP.")
      // router.push(`/signin?email=${encodeURIComponent(response.email)}`)
      
      const msg = response.message || "Registered successfully. Please sign in with OTP."
      toast.success(msg)
      setSuccessMessage(msg)
      // Reset form to initial empty values after successful registration
      try {
        reset()
      } catch (err) {
        // ignore reset errors
      }
    } catch (error: any) {
      const payload = error?.response?.data || error?.data || null

      if (payload && typeof payload === "object") {
        if (payload.details && typeof payload.details === "object") {
          Object.entries(payload.details).forEach(([field, msg]) => {
            try {
              setError(field as any, { type: "server", message: String(msg) })
            } catch {
            }
          })
        }

        const message = payload.error || error?.message || "Registration failed."
        setFormError(String(message))
        toast.error(String(message))
      } else {
        const message = error?.response?.data?.error || error?.message || "Registration failed."
        setFormError(String(message))
        toast.error(String(message))
      }
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[28px_28px] opacity-20" />
      <div className="relative mx-auto max-w-4xl">
        <div className="flex w-full flex-col gap-6">
          {/* <a href="#" className="flex items-center gap-2 self-center font-medium">
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500 text-slate-950">
              <GalleryVerticalEnd className="size-5" />
            </div>
            <span className="text-lg">Tenant Command</span>
          </a> */}

          <div className={cn("flex flex-col gap-6")}>
            <Card className="border-border bg-card text-card-foreground shadow-xl backdrop-blur-xl">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-500">
                  <Building2 className="size-5 " />
                </div>
                <CardTitle className="text-xl">Register Tenant Admin</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Create your tenant account first. Then sign in with OTP using the registered email.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onRegister} noValidate>
                  <div className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="firstName" className="text-foreground">First name</Label>
                        <Input
                          id="firstName"
                          {...register("firstName", {
                            required: "First name is required.",
                            maxLength: { value: LIMITS.firstName, message: `First name must be at most ${LIMITS.firstName} characters.` },
                            pattern: { value: NAME_PATTERN, message: "First name may only contain letters, spaces, hyphens and apostrophes." },
                          })}
                        />
                        {showFieldErrors && errors.firstName?.message ? (
                          <p className="text-xs text-destructive">{String(errors.firstName.message)}</p>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName" className="text-foreground">Last name</Label>
                        <Input
                          id="lastName"
                          {...register("lastName", {
                            required: "Last name is required.",
                            maxLength: { value: LIMITS.lastName, message: `Last name must be at most ${LIMITS.lastName} characters.` },
                            pattern: { value: NAME_PATTERN, message: "Last name may only contain letters, spaces, hyphens and apostrophes." },
                          })}
                        />
                        {showFieldErrors && errors.lastName?.message ? (
                          <p className="text-xs text-destructive">{String(errors.lastName.message)}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@company.com"
                        {...register("email", {
                          required: "Email is required.",
                          maxLength: { value: LIMITS.email, message: `Email must be at most ${LIMITS.email} characters.` },
                          pattern: { value: EMAIL_PATTERN, message: "Please provide a valid email address." },
                        })}
                      />
                      {showFieldErrors && errors.email?.message ? (
                        <p className="text-xs text-destructive">{String(errors.email.message)}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="companyName" className="text-foreground">Company name</Label>
                      <Input
                        id="companyName"
                        placeholder="Acme Inc"
                        {...register("companyName", {
                          required: "Company name is required.",
                          maxLength: { value: LIMITS.companyName, message: `Company name must be at most ${LIMITS.companyName} characters.` },
                        })}
                      />
                      {showFieldErrors && errors.companyName?.message ? (
                        <p className="text-xs text-destructive">{String(errors.companyName.message)}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="countryId" className="text-foreground">Country</Label>
                      <Controller
                        name="countryId"
                        control={control}
                        rules={{
                          required: "Country is required.",
                          validate: (v) => (String(v || "").trim() ? true : "Please select a valid country."),
                        }}
                        render={({ field }) => (
                          <DropdownList
                            data={sortedCountries}
                            dataKey="id"
                            textField="name"
                            value={sortedCountries.find((country) => country.id === field.value) || null}
                            onChange={(value) => field.onChange((value as ActiveCountry | null)?.id || "")}
                            disabled={isLoadingCountries}
                            placeholder={isLoadingCountries ? "Loading countries..." : "Select country"}
                            className=" w-full"
                            inputProps={{
                              id: "countryId",
                              className: "h-10",
                            }}
                          />
                        )}
                      />
                      {showFieldErrors && errors.countryId?.message ? (
                        <p className="text-xs text-destructive">{String(errors.countryId.message)}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="phone" className="text-foreground">Phone</Label>
                          <Input
                            id="phone"
                              {...register("phone", {
                                required: "Phone is required.",
                                pattern: { value: PHONE_PATTERN, message: "Phone must contain digits only (0-9)." },
                                maxLength: { value: LIMITS.phone, message: `Phone must be at most ${LIMITS.phone} characters.` },
                              })}
                        />
                        {showFieldErrors && errors.phone?.message ? (
                          <p className="text-xs text-destructive">{String(errors.phone.message)}</p>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="postalCode" className="text-foreground">Postal code</Label>
                          <Input id="postalCode" {...register("postalCode", { required: "Postal code is required.", maxLength: { value: LIMITS.postalCode, message: `Postal code must be at most ${LIMITS.postalCode} characters.` } })} />
                        {showFieldErrors && errors.postalCode?.message ? (
                          <p className="text-xs text-destructive">{String(errors.postalCode.message)}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="address1" className="text-foreground">Address line 1</Label>
                      <Input id="address1" {...register("address1", { required: "Address line 1 is required.", maxLength: { value: LIMITS.address1, message: `Address line 1 must be at most ${LIMITS.address1} characters.` } })} />
                      {showFieldErrors && errors.address1?.message ? (
                        <p className="text-xs text-destructive">{String(errors.address1.message)}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="address2" className="text-foreground">Address line 2</Label>
                      <Input id="address2" {...register("address2", { required: "Address line 2 is required.", maxLength: { value: LIMITS.address2, message: `Address line 2 must be at most ${LIMITS.address2} characters.` } })} />
                      {showFieldErrors && errors.address2?.message ? (
                        <p className="text-xs text-destructive">{String(errors.address2.message)}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="city" className="text-foreground">City</Label>
                        <Input id="city" {...register("city", { required: "City is required.", maxLength: { value: LIMITS.city, message: `City must be at most ${LIMITS.city} characters.` }, pattern: { value: CITY_STATE_PATTERN, message: "City contains invalid characters." } })} />
                        {showFieldErrors && errors.city?.message ? (
                          <p className="text-xs text-destructive">{String(errors.city.message)}</p>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="state" className="text-foreground">State</Label>
                        <Input id="state" {...register("state", { required: "State is required.", maxLength: { value: LIMITS.state, message: `State must be at most ${LIMITS.state} characters.` }, pattern: { value: CITY_STATE_PATTERN, message: "State contains invalid characters." } })} />
                        {showFieldErrors && errors.state?.message ? (
                          <p className="text-xs text-destructive">{String(errors.state.message)}</p>
                        ) : null}
                      </div>
                    </div>

                    {formError ? (
                      <div className="mb-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                        {formError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={isSubmitting || isLoadingCountries}
                      className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl border border-emerald-300/40 bg-emerald-400 px-4 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    >
                      {isSubmitting ? "Registering..." : "Register Tenant"}
                    </button>
                  </div>
                </form>

                <div className="mt-4 text-center text-sm">
                  Already registered? {" "}
                  <Link href={TENANT_SIGNIN_PATH} className="underline underline-offset-4">
                    Sign in
                  </Link>
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
