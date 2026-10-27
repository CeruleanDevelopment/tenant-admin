"use client"

import { useEffect, useMemo, useState } from "react"
import { useDispatch } from "react-redux"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProfileImageUploader } from "@/components/profile-image-uploader"
import {
  fetchUserProfile,
  updateUserProfile,
  uploadUserProfilePhoto,
  type UserProfile,
} from "../../../../actions/auth"
import type { AppDispatch } from "../../../../redux/store"
import { validatePersonName } from "../../../../utils/profile-validation"

const formatDate = (value?: string | null): string => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString()
}

export default function UserAccountPage() {
  const dispatch = useDispatch<AppDispatch>()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void dispatch(fetchUserProfile())
      .then((data) => {
        if (!active) return
        setProfile(data)
        setFirstName(data?.firstName || "")
        setLastName(data?.lastName || "")
      })
      .catch(() => active && setError("Failed to load profile."))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [dispatch])

  const errors = useMemo(
    () => ({
      firstName: validatePersonName(firstName, "First name", true),
      lastName: validatePersonName(lastName, "Last name", false),
    }),
    [firstName, lastName],
  )

  const isDirty =
    firstName.trim() !== (profile?.firstName || "") || lastName.trim() !== (profile?.lastName || "")
  const canSave = isDirty && !errors.firstName && !errors.lastName && !saving

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const updated = await dispatch(
        updateUserProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
      )
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
      setFirstName(updated.firstName || "")
      setLastName(updated.lastName || "")
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

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || ""

  const rows: Array<[string, string]> = [
    ["Email", profile?.email || "-"],
    ["Role", profile?.role || "-"],
    ["Organization", profile?.companyName || "-"],
    ["Status", profile?.isActive ? "Active" : "Inactive"],
    // ["Member since", formatDate(profile?.createdAt)],
  ]

  return (
    <main className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
          <CardDescription>Update your name and photo. Email and role are managed by your tenant admin.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
          {!profile && error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {profile ? (
            <form onSubmit={onSubmit} noValidate className="space-y-6">
              <ProfileImageUploader
                src={profile.picture}
                fallback={fullName.slice(0, 2).toUpperCase()}
                label="Change photo"
                hint="PNG, JPG or WEBP. Max 2 MB."
                onUpload={async (file) => {
                  const picture = await dispatch(uploadUserProfilePhoto(file))
                  setProfile((prev) => (prev ? { ...prev, picture } : prev))
                  toast.success("Profile photo updated.")
                }}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={100}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                  {errors.firstName ? <p className="text-xs text-rose-600">{errors.firstName}</p> : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={100}
                    aria-invalid={Boolean(errors.lastName)}
                  />
                  {errors.lastName ? <p className="text-xs text-rose-600">{errors.lastName}</p> : null}
                </div>
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={!canSave} className="cursor-pointer disabled:cursor-not-allowed">
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>

              <dl className="grid gap-4 border-t pt-6 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
