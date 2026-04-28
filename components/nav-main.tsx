"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const pathname = usePathname()

  // Pick the most-specific (longest) matching URL so sibling routes
  // (e.g. /exams and /exams/enrollment) never both appear active.
  const bestMatch = items
    .filter((i) => pathname === i.url || pathname.startsWith(i.url + "/"))
    .reduce<string | null>(
      (best, i) => (best === null || i.url.length > best.length ? i.url : best),
      null
    )

  return (
    // Default p-2 on SidebarGroup keeps icons at x=8, same as header/footer
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
        Menu
      </SidebarGroupLabel>
      <SidebarMenu className="gap-0.5">
        {items.map((item) => {
          const isActive = item.url === bestMatch
          const Icon = item.icon
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
                className="rounded-lg font-medium transition-all duration-150
                  text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/70
                  data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground
                  data-[active=true]:shadow-sm data-[active=true]:hover:bg-sidebar-primary"
              >
                <Link href={item.url}>
                  <Icon className="size-4 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
