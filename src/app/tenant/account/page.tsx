"use client"

import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  fetchCountries,
  updateTenantProfile,
  uploadTenantLogo,
  type ActiveCountry,
} from "../../../../actions/auth"
import { ProfileImageUploader } from "@/components/profile-image-uploader"
import { validateTenantProfileForm, type TenantProfileFormErrors } from "../../../../utils/profile-validation"
import type { RootState } from "../../../../redux/reducers"
import type { AppDispatch } from "../../../../redux/store"

type FormState = {
  companyName: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
  countryId: string
}

const toForm = (profile: RootState["tenant"]["profile"]): FormState => ({
  companyName: profile?.companyName || "",
  phone: profile?.phone || "",
  address1: profile?.address1 || "",
  address2: profile?.address2 || "",
  city: profile?.city || "",
  state: profile?.state || "",
  postalCode: profile?.postalCode || "",
  countryId: profile?.countryId || "",
})

export default function TenantAccountPage() {
  const dispatch = useDispatch<AppDispatch>()
  const profile = useSelector((state: RootState) => state.tenant.profile)
  const [form, setForm] = useState<FormState>(() => toForm(profile))
  const [countries, setCountries] = useState<ActiveCountry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<TenantProfileFormErrors>({})

  useEffect(() => {
    setForm(toForm(profile))
  }, [profile])

  useEffect(() => {
    let active = true
    void dispatch(fetchCountries())
      .then((rows) => active && setCountries(rows))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [dispatch])

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateTenantProfileForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setError(null)
      return
    }
    setError(null)
    setSaving(true)
    try {
      await dispatch(updateTenantProfile(form))
      toast.success("Profile updated successfully.")
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        "Failed to update profile."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Tenant Account</CardTitle>
          <CardDescription>Manage your organization profile. Email cannot be changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <ProfileImageUploader
              src={profile?.picture}
              fallback={(profile?.companyName || "T").slice(0, 2).toUpperCase()}
              label="Change company logo"
              hint="PNG, JPG or WEBP. Max 2 MB."
              onUpload={async (file) => {
                await dispatch(uploadTenantLogo(file))
                toast.success("Company logo updated.")
              }}
            />

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile?.email || ""} readOnly disabled />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input id="companyName" value={form.companyName} onChange={setField("companyName")} maxLength={255} required />
              {fieldErrors.companyName ? <p className="text-xs text-rose-600">{fieldErrors.companyName}</p> : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={setField("phone")} maxLength={32} />
                {fieldErrors.phone ? <p className="text-xs text-rose-600">{fieldErrors.phone}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="countryId">Country</Label>
                <select
                  id="countryId"
                  value={form.countryId}
                  onChange={setField("countryId")}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address1">Address line 1</Label>
              <Input id="address1" value={form.address1} onChange={setField("address1")} maxLength={255} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address2">Address line 2</Label>
              <Input id="address2" value={form.address2} onChange={setField("address2")} maxLength={255} />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={setField("city")} maxLength={128} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state} onChange={setField("state")} maxLength={128} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" value={form.postalCode} onChange={setField("postalCode")} maxLength={32} />
                {fieldErrors.postalCode ? <p className="text-xs text-rose-600">{fieldErrors.postalCode}</p> : null}
              </div>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
