"use client"

import { useEffect, useRef, useState } from "react"
import { CameraIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { PROFILE_IMAGE_TYPES, resolveAssetUrl, validateImageFile } from "../../utils/profile-validation"

type Props = {
  src?: string | null
  fallback: string
  label: string
  hint: string
  onUpload: (file: File) => Promise<void>
}

export function ProfileImageUploader({ src, fallback, label, hint, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const problem = validateImageFile(file)
    if (problem) {
      setError(problem)
      toast.error(problem)
      return
    }

    setError(null)
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      await onUpload(file)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (status === 413 ? "Image must be 2 MB or smaller." : "") ||
        (err as Error)?.message ||
        "Upload failed."
      setError(message)
      toast.error(message)
    } finally {
      setPreview(null)
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={label}
        className="group relative cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-24 w-24 border">
          <AvatarImage src={preview || resolveAssetUrl(src)} alt={label} className="object-cover" />
          <AvatarFallback className="text-xl">{fallback}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <CameraIcon className="size-6" />
        </span>
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white">
            <Loader2Icon className="size-6 animate-spin" />
          </span>
        ) : null}
      </button>

      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="cursor-pointer">
          {uploading ? "Uploading..." : label}
        </Button>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PROFILE_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={onPick}
      />
    </div>
  )
}

export default ProfileImageUploader
