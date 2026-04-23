"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GraduationCap, ShieldCheck, ArrowLeft } from "lucide-react";

function RegisterContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">HI Tech Examination</p>
            <p className="text-sm text-muted-foreground">Admin</p>
          </div>
        </div>

        {/* Card */}
        <Card className="w-full bg-card border rounded-2xl p-8 shadow-sm space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
              <ShieldCheck className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-foreground">Admin Registration</h1>
              <p className="text-sm text-muted-foreground">Invite-only access</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground text-left bg-muted/50 border rounded-xl p-4">
            <p>
              Admin accounts are created by existing admins. If you were invited, you will receive a
              verification email with a link to set your password.
            </p>
            <p>
              After verifying your email, you will be redirected to set your password.
            </p>
          </div>

          <Link href="/admin/login">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go to Login
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
