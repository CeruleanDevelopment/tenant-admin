import { API_URL } from "../config/config"

export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const PROFILE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u

export const resolveAssetUrl = (value?: string | null): string => {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw
  return `${API_URL.replace(/\/$/, "")}${raw.startsWith("/") ? "" : "/"}${raw}`
}

export const validateImageFile = (file: File): string | null => {
  if (!PROFILE_IMAGE_TYPES.includes(file.type)) return "Unsupported file type. Please choose a PNG, JPG or WEBP image."
  if (file.size === 0) return "The selected image is empty."
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image is ${sizeMb} MB. Maximum allowed size is 2 MB.`
  }
  return null
}

export const validatePersonName = (value: string, label: string, required: boolean): string | null => {
  const text = value.trim()
  if (!text) return required ? `${label} is required.` : null
  if (text.length > 100) return `${label} must be 100 characters or fewer.`
  if (!NAME_PATTERN.test(text)) return `${label} may only contain letters, spaces, . ' and -.`
  return null
}

export type TenantProfileFormErrors = Partial<
  Record<"companyName" | "phone" | "address1" | "address2" | "city" | "state" | "postalCode", string>
>

export const validateTenantProfileForm = (form: {
  companyName: string
  phone: string
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
}): TenantProfileFormErrors => {
  const errors: TenantProfileFormErrors = {}
  const company = form.companyName.trim()
  if (company.length < 2) errors.companyName = "Company name must be at least 2 characters."
  else if (company.length > 255) errors.companyName = "Company name must be 255 characters or fewer."

  const phone = form.phone.trim()
  if (phone && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) errors.phone = "Enter a valid phone number."

  const postal = form.postalCode.trim()
  if (postal && !/^[A-Za-z0-9\s-]{3,12}$/.test(postal)) errors.postalCode = "Enter a valid postal code."

  const limits = { address1: 255, address2: 255, city: 128, state: 128 } as const
  for (const key of Object.keys(limits) as Array<keyof typeof limits>) {
    if (form[key].trim().length > limits[key]) errors[key] = `Must be ${limits[key]} characters or fewer.`
  }
  return errors
}
