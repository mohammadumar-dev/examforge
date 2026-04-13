import { AuthProvider } from "@/components/admin/AuthProvider";
import { DashboardNav } from "@/components/admin/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-background">
        <DashboardNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </AuthProvider>
  );
}
