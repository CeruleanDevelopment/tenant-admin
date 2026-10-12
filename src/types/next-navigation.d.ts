declare module "next/navigation" {
  type AppRouterInstance = {
    back(): void
    forward(): void
    refresh(): void
    push(href: string, options?: { scroll?: boolean }): void
    replace(href: string, options?: { scroll?: boolean }): void
    prefetch(href: string): void
  }

  export function usePathname(): string
  export function useRouter(): AppRouterInstance
  export function useSearchParams(): URLSearchParams | null
}
