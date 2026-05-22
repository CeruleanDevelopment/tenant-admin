declare module "next/navigation" {
  export function usePathname(): string
  export function useRouter(): unknown
  export function useSearchParams(): URLSearchParams | null
}
