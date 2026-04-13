"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard/exams", label: "Exams", icon: FileText },
  { href: "/admin/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();

  return (
    <nav className="w-60 shrink-0 border-r bg-card flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg tracking-tight">ExamForge</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Admin Panel</p>
      </div>

      <div className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {admin && (
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{admin.name}</p>
              <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={logout}
          >
            <LogOut size={14} />
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}
