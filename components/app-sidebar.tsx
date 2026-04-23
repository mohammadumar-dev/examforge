"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { FileSpreadsheet, GraduationCap, Settings, ShieldCheck } from "lucide-react"

const navItems = [
  {
    title: "Exams",
    url: "/admin/dashboard/exams",
    icon: FileSpreadsheet,
  },
  {
    title: "Admins",
    url: "/admin/dashboard/admins",
    icon: ShieldCheck,
  },
  {
    title: "Settings",
    url: "/admin/dashboard/settings",
    icon: Settings,
  },
]

// A simple 1px rule that always stays within the sidebar bounds — no overflow in any state
function SidebarDivider() {
  return <div className="h-px shrink-0 bg-sidebar-border" />
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>

      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="HI Tech Examination"
              className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
            >
              <a href="/admin/dashboard/exams">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <GraduationCap className="size-4" />
                </div>
                <div className="flex flex-col gap-0 leading-none">
                  <span className="text-sm font-semibold tracking-tight">HI Tech Examination</span>
                  <span className="text-[11px] text-sidebar-foreground/50 font-normal">Admin Panel</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarDivider />

      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>

      <SidebarDivider />

      <SidebarFooter className="p-2">
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
